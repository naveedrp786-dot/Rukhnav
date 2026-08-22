"use strict";

const db = require("../config/db");

const customerLoyaltyService =
    require("./customerLoyaltyService");

const orderSalesIntegrationService =
    require("./orderSalesIntegrationService");

const RETURN_WINDOW_DAYS = Math.max(1, Number(process.env.CUSTOMER_RETURN_WINDOW_DAYS || 14));
const ACTIVE_REQUEST_STATUSES = ["Requested", "Under Review", "Approved", "Received", "Inspected"];

const fail = (message, statusCode = 400) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
};

const cleanText = (value, maxLength = 2000) => {
    if (value === undefined || value === null) return null;
    const text = String(value).trim();
    return text ? text.slice(0, maxLength) : null;
};

const money = value => {
    const n = Number(value);
    return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
};

const positiveId = (value, label = "ID") => {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 1) throw fail(`A valid ${label} is required.`);
    return n;
};

const makeNumber = (prefix, id, now = new Date()) => {
    const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
    return `${prefix}-${date}-${String(id).padStart(6, "0")}`;
};

const rollbackQuietly = async connection => {
    try { await connection.rollback(); } catch (_) { /* no-op */ }
};

const addActivity = async (connection, data) => {
    await connection.query(
        `INSERT INTO customer_return_activity_logs
         (return_request_id, actor_type, actor_id, action, from_status, to_status, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [data.returnRequestId, data.actorType, data.actorId || null, data.action,
         data.fromStatus || null, data.toStatus || null, cleanText(data.notes)]
    );
};

const assertReturnWindow = deliveredAt => {
    const delivered = new Date(deliveredAt);
    if (!deliveredAt || Number.isNaN(delivered.getTime())) throw fail("The order has no valid delivery date.");
    const deadline = new Date(delivered);
    deadline.setDate(deadline.getDate() + RETURN_WINDOW_DAYS);
    if (new Date() > deadline) throw fail(`The ${RETURN_WINDOW_DAYS}-day return period has expired.`);
};

const updateOrderPaymentSummary = async (connection, orderId) => {
    const [[order]] = await connection.query(
        `SELECT id, grand_total FROM orders WHERE id = ? LIMIT 1 FOR UPDATE`, [orderId]
    );
    if (!order) throw fail("Order not found.", 404);

    const [[totals]] = await connection.query(
        `SELECT
            COALESCE(SUM(CASE WHEN status IN ('Paid','Partially Refunded','Refunded') THEN amount ELSE 0 END),0) gross_paid,
            COALESCE(SUM(refunded_amount),0) refunded
         FROM payment_transactions WHERE order_id = ?`, [orderId]
    );

    const grand = money(order.grand_total);
    const gross = Math.max(0, money(totals.gross_paid));
    const refunded = Math.max(0, money(totals.refunded));
    const net = Math.max(0, money(gross - refunded));

    // Refunds do not create a new receivable. Outstanding balance is based
    // on the original gross payment, not on the post-refund retained amount.
    const balance = Math.max(0, money(grand - gross));

    let status = "Pending";
    if (refunded > 0 && net <= 0) status = "Refunded";
    else if (refunded > 0) status = "Partially Refunded";
    else if (grand > 0 && gross >= grand) status = "Paid";
    else if (gross > 0) status = "Partially Paid";

    await connection.query(
        `UPDATE orders SET paid_amount = ?, balance_amount = ?, payment_status = ? WHERE id = ?`,
        [net, balance, status, orderId]
    );

    return {
        gross_paid_amount: gross,
        refunded_amount: refunded,
        paid_amount: net,
        net_paid_amount: net,
        balance_amount: balance,
        payment_status: status
    };
};

const calculateReturnFinancials = async (
    connection,
    {
        orderId,
        grossAmount
    }
) => {
    const [[order]] = await connection.query(
        `SELECT
            id,
            discount_amount,
            loyalty_discount_amount,
            reward_points_discount_amount
         FROM orders
         WHERE id = ?
         LIMIT 1
         FOR UPDATE`,
        [orderId]
    );

    if (!order) throw fail("Order not found.", 404);

    const [[subtotalRow]] = await connection.query(
        `SELECT COALESCE(SUM(subtotal), 0) AS merchandise_subtotal
         FROM order_items
         WHERE order_id = ?`,
        [orderId]
    );

    const merchandiseSubtotal = money(subtotalRow.merchandise_subtotal);
    const gross = Math.max(0, money(grossAmount));

    if (gross <= 0 || merchandiseSubtotal <= 0) {
        return {
            gross_return_amount: gross,
            coupon_discount_share: 0,
            loyalty_discount_share: 0,
            reward_discount_share: 0,
            effective_refund_amount: gross
        };
    }

    const ratio = Math.min(1, gross / merchandiseSubtotal);

    let couponShare = money(
        Math.max(0, Number(order.discount_amount || 0)) * ratio
    );
    let loyaltyShare = money(
        Math.max(0, Number(order.loyalty_discount_amount || 0)) * ratio
    );
    let rewardShare = money(
        Math.max(0, Number(order.reward_points_discount_amount || 0)) * ratio
    );

    // Defensive cap for malformed historical orders whose merchandise
    // discounts exceed merchandise value. Reduce later discounts first.
    let totalShare = money(couponShare + loyaltyShare + rewardShare);

    if (totalShare > gross) {
        let excess = money(totalShare - gross);

        const rewardReduction = Math.min(rewardShare, excess);
        rewardShare = money(rewardShare - rewardReduction);
        excess = money(excess - rewardReduction);

        const loyaltyReduction = Math.min(loyaltyShare, excess);
        loyaltyShare = money(loyaltyShare - loyaltyReduction);
        excess = money(excess - loyaltyReduction);

        const couponReduction = Math.min(couponShare, excess);
        couponShare = money(couponShare - couponReduction);
    }

    totalShare = money(couponShare + loyaltyShare + rewardShare);

    return {
        gross_return_amount: gross,
        coupon_discount_share: couponShare,
        loyalty_discount_share: loyaltyShare,
        reward_discount_share: rewardShare,
        effective_refund_amount: Math.max(0, money(gross - totalShare))
    };
};

exports.createReturnRequest = async ({ customerId, payload }) => {
    customerId = positiveId(customerId, "customer ID");
    const orderId = positiveId(payload.order_id, "order ID");
    const reason = cleanText(payload.reason, 100);
    const customerNotes = cleanText(payload.customer_notes);
    const requestedItems = Array.isArray(payload.items) ? payload.items : [];
    if (!reason) throw fail("A return reason is required.");
    if (!requestedItems.length) throw fail("At least one return item is required.");

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const [[order]] = await connection.query(
            `SELECT id, order_number, customer_id, order_status, delivered_at
             FROM orders WHERE id = ? AND customer_id = ? LIMIT 1 FOR UPDATE`,
            [orderId, customerId]
        );
        if (!order) throw fail("Order not found.", 404);
        if (String(order.order_status).toLowerCase() !== "delivered") throw fail("Only delivered orders can be returned.", 409);
        assertReturnWindow(order.delivered_at);

        const quantities = new Map();
        for (const row of requestedItems) {
            const orderItemId = positiveId(row.order_item_id, "order item ID");
            const quantity = Number(row.quantity);
            if (!Number.isInteger(quantity) || quantity < 1) throw fail("Each return quantity must be a positive whole number.");
            quantities.set(orderItemId, (quantities.get(orderItemId) || 0) + quantity);
        }

        const ids = [...quantities.keys()];
        const marks = ids.map(() => "?").join(",");
        const [orderItems] = await connection.query(
            `SELECT oi.id, oi.product_id, oi.quantity, oi.price, p.product_name
             FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id
             WHERE oi.order_id = ? AND oi.id IN (${marks}) FOR UPDATE`, [orderId, ...ids]
        );
        if (orderItems.length !== ids.length) throw fail("One or more selected items do not belong to this order.");

        const [usedRows] = await connection.query(
            `SELECT cri.order_item_id, COALESCE(SUM(cri.requested_quantity),0) already_requested
             FROM customer_return_items cri
             JOIN customer_return_requests crr ON crr.id = cri.return_request_id
             WHERE crr.order_id = ? AND crr.status IN (${ACTIVE_REQUEST_STATUSES.map(() => "?").join(",")})
             GROUP BY cri.order_item_id`, [orderId, ...ACTIVE_REQUEST_STATUSES]
        );
        const used = new Map(usedRows.map(r => [Number(r.order_item_id), Number(r.already_requested)]));

        let requestedAmount = 0;
        const items = orderItems.map(item => {
            const requestedQuantity = quantities.get(Number(item.id));
            const remaining = Number(item.quantity) - (used.get(Number(item.id)) || 0);
            if (requestedQuantity > remaining) throw fail(`${item.product_name || "Product"}: only ${remaining} unit(s) remain returnable.`, 409);
            const unitPrice = money(item.price);
            const amount = money(unitPrice * requestedQuantity);
            requestedAmount = money(requestedAmount + amount);
            return { ...item, requestedQuantity, unitPrice, amount };
        });

        const [result] = await connection.query(
            `INSERT INTO customer_return_requests
             (order_id, customer_id, reason, customer_notes, status, requested_amount)
             VALUES (?, ?, ?, ?, 'Requested', ?)`,
            [orderId, customerId, reason, customerNotes, requestedAmount]
        );
        const returnId = result.insertId;
        const returnNumber = makeNumber("RET", returnId);
        await connection.query(`UPDATE customer_return_requests SET return_number = ? WHERE id = ?`, [returnNumber, returnId]);

        for (const item of items) {
            await connection.query(
                `INSERT INTO customer_return_items
                 (
                    return_request_id,
                    order_item_id,
                    product_id,
                    requested_quantity,
                    unit_price,
                    requested_amount,
                    gross_return_amount,
                    effective_refund_amount,
                    item_status
                 )
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Requested')`,
                [
                    returnId,
                    item.id,
                    item.product_id,
                    item.requestedQuantity,
                    item.unitPrice,
                    item.amount,
                    item.amount,
                    item.amount
                ]
            );
        }
        await addActivity(connection, { returnRequestId: returnId, actorType: "Customer", actorId: customerId,
            action: "Return request submitted", toStatus: "Requested", notes: reason });
        await connection.commit();
        return { id: returnId, return_number: returnNumber, order_id: orderId, order_number: order.order_number,
            status: "Requested", requested_amount: requestedAmount, item_count: items.length };
    } catch (error) {
        await rollbackQuietly(connection); throw error;
    } finally { connection.release(); }
};

exports.getCustomerReturns = async customerId => {
    customerId = positiveId(customerId, "customer ID");
    const [rows] = await db.query(
        `SELECT crr.id, crr.return_number, crr.order_id, o.order_number, crr.reason, crr.status,
                crr.requested_amount, crr.approved_amount, crr.refund_amount, crr.created_at, crr.updated_at,
                COUNT(cri.id) item_count, COALESCE(SUM(cri.requested_quantity),0) total_quantity
         FROM customer_return_requests crr JOIN orders o ON o.id = crr.order_id
         LEFT JOIN customer_return_items cri ON cri.return_request_id = crr.id
         WHERE crr.customer_id = ? GROUP BY crr.id ORDER BY crr.created_at DESC, crr.id DESC`, [customerId]
    );
    return rows;
};

exports.getReturnDetails = async ({ returnId, customerId = null, admin = false }) => {
    returnId = positiveId(returnId, "return ID");
    const params = [returnId];
    let owner = "";
    if (!admin) { customerId = positiveId(customerId, "customer ID"); owner = "AND crr.customer_id = ?"; params.push(customerId); }
    const [[request]] = await db.query(
        `SELECT crr.*, o.order_number, o.order_status, o.payment_status, o.payment_method, o.grand_total,
                o.delivered_at, c.full_name customer_name, c.email customer_email, c.phone customer_phone
         FROM customer_return_requests crr JOIN orders o ON o.id = crr.order_id
         JOIN customers c ON c.id = crr.customer_id WHERE crr.id = ? ${owner} LIMIT 1`, params
    );
    if (!request) throw fail("Return request not found.", 404);
    const [items] = await db.query(
        `SELECT cri.*, p.product_name, oi.quantity purchased_quantity, oi.subtotal purchased_subtotal
         FROM customer_return_items cri JOIN order_items oi ON oi.id = cri.order_item_id
         LEFT JOIN products p ON p.id = cri.product_id WHERE cri.return_request_id = ? ORDER BY cri.id`, [returnId]
    );
    const [activity] = await db.query(
        `SELECT id, actor_type, actor_id, action, from_status, to_status, notes, created_at
         FROM customer_return_activity_logs WHERE return_request_id = ? ORDER BY created_at, id`, [returnId]
    );
    const [movements] = await db.query(
        `SELECT rim.*, p.product_name FROM return_inventory_movements rim
         LEFT JOIN products p ON p.id = rim.product_id WHERE rim.return_request_id = ? ORDER BY rim.id`, [returnId]
    );
    return { return_request: request, items, activity, inventory_movements: movements };
};

exports.cancelCustomerReturn = async ({ returnId, customerId, notes }) => {
    returnId = positiveId(returnId, "return ID"); customerId = positiveId(customerId, "customer ID");
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const [[row]] = await connection.query(
            `SELECT id, status FROM customer_return_requests WHERE id = ? AND customer_id = ? LIMIT 1 FOR UPDATE`, [returnId, customerId]
        );
        if (!row) throw fail("Return request not found.", 404);
        if (row.status !== "Requested") throw fail("Only an unreviewed return request can be cancelled.", 409);
        await connection.query(`UPDATE customer_return_requests SET status='Cancelled', cancelled_at=CURRENT_TIMESTAMP WHERE id=?`, [returnId]);
        await addActivity(connection, { returnRequestId: returnId, actorType: "Customer", actorId: customerId,
            action: "Return request cancelled", fromStatus: "Requested", toStatus: "Cancelled", notes });
        await connection.commit(); return { id: returnId, status: "Cancelled" };
    } catch (error) { await rollbackQuietly(connection); throw error; } finally { connection.release(); }
};

exports.getAdminReturnSummary = async () => {
    const [[row]] = await db.query(
        `SELECT COUNT(*) total_returns,
            SUM(status='Requested') requested_returns, SUM(status='Under Review') under_review_returns,
            SUM(status='Approved') approved_returns, SUM(status='Rejected') rejected_returns,
            SUM(status='Cancelled') cancelled_returns, SUM(status='Received') received_returns,
            SUM(status='Inspected') inspected_returns, SUM(status='Completed') completed_returns,
            SUM(status='Refunded') refunded_returns, COALESCE(SUM(requested_amount),0) requested_value,
            COALESCE(SUM(approved_amount),0) approved_value, COALESCE(SUM(refund_amount),0) refunded_value
         FROM customer_return_requests`
    );
    return Object.fromEntries(Object.entries(row || {}).map(([k,v]) => [k, Number(v || 0)]));
};

exports.getAdminReturns = async filters => {
    const page = Math.max(1, Number(filters.page || 1));
    const limit = Math.min(100, Math.max(1, Number(filters.limit || 20)));
    const where = [], params = [];
    if (filters.status) { where.push("crr.status = ?"); params.push(cleanText(filters.status, 40)); }
    if (filters.search) {
        where.push("(crr.return_number LIKE ? OR o.order_number LIKE ? OR c.full_name LIKE ? OR c.email LIKE ? OR c.phone LIKE ?)");
        const p = `%${cleanText(filters.search, 150)}%`; params.push(p,p,p,p,p);
    }
    const sqlWhere = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const [[count]] = await db.query(
        `SELECT COUNT(*) total FROM customer_return_requests crr JOIN orders o ON o.id=crr.order_id
         JOIN customers c ON c.id=crr.customer_id ${sqlWhere}`, params
    );
    const [rows] = await db.query(
        `SELECT crr.id, crr.return_number, crr.order_id, o.order_number, crr.customer_id,
                c.full_name customer_name, c.email customer_email, c.phone customer_phone,
                crr.reason, crr.status, crr.requested_amount, crr.approved_amount, crr.refund_amount,
                crr.created_at, crr.updated_at, COUNT(cri.id) item_count,
                COALESCE(SUM(cri.requested_quantity),0) total_quantity
         FROM customer_return_requests crr JOIN orders o ON o.id=crr.order_id
         JOIN customers c ON c.id=crr.customer_id LEFT JOIN customer_return_items cri ON cri.return_request_id=crr.id
         ${sqlWhere} GROUP BY crr.id ORDER BY crr.created_at DESC, crr.id DESC LIMIT ? OFFSET ?`,
        [...params, limit, (page-1)*limit]
    );
    const total = Number(count.total || 0);
    return { returns: rows, pagination: { page, limit, total, total_pages: Math.ceil(total/limit) } };
};

exports.reviewReturnRequest = async ({ returnId, adminId, decision, adminNotes }) => {
    returnId = positiveId(returnId, "return ID"); adminId = positiveId(adminId, "admin ID");
    const action = String(decision || "").trim().toLowerCase();
    if (!["review","approve","reject"].includes(action)) throw fail("Decision must be review, approve, or reject.");
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const [[row]] = await connection.query(
            `SELECT id,status,requested_amount FROM customer_return_requests WHERE id=? LIMIT 1 FOR UPDATE`, [returnId]
        );
        if (!row) throw fail("Return request not found.",404);
        if (!["Requested","Under Review"].includes(row.status)) throw fail("This return request has already been decided.",409);
        const map={review:"Under Review",approve:"Approved",reject:"Rejected"}; const next=map[action];
        let extra="";
        if(next==="Approved") extra=", approved_at=CURRENT_TIMESTAMP, approved_amount=requested_amount";
        if(next==="Rejected") extra=", rejected_at=CURRENT_TIMESTAMP, approved_amount=0";
        await connection.query(
            `UPDATE customer_return_requests SET status=?,admin_notes=?,reviewed_by_admin_id=?,reviewed_at=CURRENT_TIMESTAMP ${extra} WHERE id=?`,
            [next, cleanText(adminNotes), adminId, returnId]
        );
        if(next==="Approved") await connection.query(
            `UPDATE customer_return_items SET item_status='Approved',approved_quantity=requested_quantity,approved_amount=requested_amount WHERE return_request_id=?`,[returnId]
        );
        if(next==="Rejected") await connection.query(
            `UPDATE customer_return_items SET item_status='Rejected',approved_quantity=0,approved_amount=0 WHERE return_request_id=?`,[returnId]
        );
        await addActivity(connection,{returnRequestId:returnId,actorType:"Admin",actorId:adminId,
            action:`Return request ${action === "review" ? "moved under review" : action + "d"}`,
            fromStatus:row.status,toStatus:next,notes:adminNotes});
        await connection.commit(); return {id:returnId,status:next};
    } catch(error){await rollbackQuietly(connection);throw error;} finally{connection.release();}
};

exports.receiveReturn = async ({ returnId, adminId, notes }) => {
    returnId=positiveId(returnId,"return ID"); adminId=positiveId(adminId,"admin ID");
    const connection=await db.getConnection();
    try{
        await connection.beginTransaction();
        const [[row]]=await connection.query(`SELECT id,status,order_id FROM customer_return_requests WHERE id=? LIMIT 1 FOR UPDATE`,[returnId]);
        if(!row) throw fail("Return request not found.",404);
        if(row.status!=="Approved") throw fail("Only an approved return can be marked received.",409);
        await connection.query(`UPDATE customer_return_requests SET status='Received',received_at=CURRENT_TIMESTAMP WHERE id=?`,[returnId]);
        await connection.query(`UPDATE customer_return_items SET item_status='Received',received_quantity=approved_quantity WHERE return_request_id=?`,[returnId]);
        await connection.query(`UPDATE orders SET order_status='Returned',returned_at=COALESCE(returned_at,CURRENT_TIMESTAMP) WHERE id=?`,[row.order_id]);
        await addActivity(connection,{returnRequestId:returnId,actorType:"Admin",actorId:adminId,action:"Returned goods received",fromStatus:"Approved",toStatus:"Received",notes});
        await connection.commit(); return {id:returnId,status:"Received"};
    }catch(error){await rollbackQuietly(connection);throw error;}finally{connection.release();}
};

exports.inspectReturn = async ({ returnId, adminId, payload }) => {
    returnId=positiveId(returnId,"return ID"); adminId=positiveId(adminId,"admin ID");
    const itemInput=Array.isArray(payload.items)?payload.items:[];
    if(!itemInput.length) throw fail("Inspection items are required.");
    const connection=await db.getConnection();
    try{
        await connection.beginTransaction();
        const [[row]]=await connection.query(`SELECT id,status,order_id FROM customer_return_requests WHERE id=? LIMIT 1 FOR UPDATE`,[returnId]);
        if(!row) throw fail("Return request not found.",404);
        if(row.status!=="Received") throw fail("Only a received return can be inspected.",409);
        const requestOrderId = Number(row.order_id);
        const [items]=await connection.query(`SELECT * FROM customer_return_items WHERE return_request_id=? FOR UPDATE`,[returnId]);
        const byId=new Map(items.map(i=>[Number(i.id),i]));
        let approvedTotal=0;
        for(const input of itemInput){
            const id=positiveId(input.return_item_id,"return item ID"); const item=byId.get(id);
            if(!item) throw fail("One or more inspection items are invalid.");
            const accepted=Number(input.accepted_quantity); const received=Number(item.received_quantity || item.approved_quantity || 0);
            if(!Number.isInteger(accepted)||accepted<0||accepted>received) throw fail("Accepted quantity must be between zero and received quantity.");
            const condition=cleanText(input.condition_status,40)||"Good";
            if(!["Good","Opened","Damaged","Expired","Not Resellable"].includes(condition)) throw fail("Invalid condition status.");

            const grossAcceptedAmount = money(Number(item.unit_price) * accepted);
            const financials = await calculateReturnFinancials(
                connection,
                {
                    orderId: requestOrderId,
                    grossAmount: grossAcceptedAmount
                }
            );

            approvedTotal = money(
                approvedTotal +
                financials.effective_refund_amount
            );

            await connection.query(
                `UPDATE customer_return_items
                 SET
                    item_status='Inspected',
                    accepted_quantity=?,
                    restock_quantity=0,
                    gross_return_amount=?,
                    coupon_discount_share=?,
                    loyalty_discount_share=?,
                    reward_discount_share=?,
                    effective_refund_amount=?,
                    approved_amount=?,
                    condition_status=?,
                    inspection_notes=?
                 WHERE id=?`,
                [
                    accepted,
                    financials.gross_return_amount,
                    financials.coupon_discount_share,
                    financials.loyalty_discount_share,
                    financials.reward_discount_share,
                    financials.effective_refund_amount,
                    financials.effective_refund_amount,
                    condition,
                    cleanText(input.inspection_notes),
                    id
                ]
            );
        }
        await connection.query(`UPDATE customer_return_requests SET status='Inspected',approved_amount=?,inspection_notes=?,inspected_at=CURRENT_TIMESTAMP WHERE id=?`,
            [approvedTotal,cleanText(payload.inspection_notes),returnId]);
        await addActivity(connection,{returnRequestId:returnId,actorType:"Admin",actorId:adminId,action:"Returned goods inspected",fromStatus:"Received",toStatus:"Inspected",notes:payload.inspection_notes});
        await connection.commit(); return {id:returnId,status:"Inspected",approved_amount:approvedTotal};
    }catch(error){await rollbackQuietly(connection);throw error;}finally{connection.release();}
};

exports.completeReturn = async ({ returnId, adminId, payload }) => {
    returnId=positiveId(returnId,"return ID"); adminId=positiveId(adminId,"admin ID");
    const refundRequested = payload.issue_refund !== false;
    const restock = payload.restock !== false;
    const connection=await db.getConnection();
    try{
        await connection.beginTransaction();
        const [[request]]=await connection.query(
            `SELECT * FROM customer_return_requests WHERE id=? LIMIT 1 FOR UPDATE`,[returnId]
        );
        if(!request) throw fail("Return request not found.",404);
        if(request.status!=="Inspected") throw fail("Only an inspected return can be completed.",409);
        const [items]=await connection.query(`SELECT * FROM customer_return_items WHERE return_request_id=? FOR UPDATE`,[returnId]);

        if(restock){
            for(const item of items){
                const accepted=Number(item.accepted_quantity||0);
                const eligible=["Good","Opened"].includes(item.condition_status) ? accepted : 0;
                if(eligible<1) continue;
                const [[product]]=await connection.query(`SELECT id,stock_quantity,low_stock_level FROM products WHERE id=? LIMIT 1 FOR UPDATE`,[item.product_id]);
                if(!product) continue;
                const before=Number(product.stock_quantity||0), after=before+eligible;
                const status=after<=0?"Out of Stock":after<=Number(product.low_stock_level||0)?"Low Stock":"In Stock";
                await connection.query(`UPDATE products SET stock_quantity=?,stock_status=? WHERE id=?`,[after,status,item.product_id]);
                await connection.query(
                    `INSERT INTO return_inventory_movements(return_request_id,return_item_id,product_id,quantity,stock_before,stock_after,movement_type,created_by)
                     VALUES(?,?,?,?,?,?,'Return Restock',?)`,[returnId,item.id,item.product_id,eligible,before,after,adminId]
                );
                await connection.query(`UPDATE customer_return_items SET restock_quantity=? WHERE id=?`,[eligible,item.id]);
            }
        }

        const refundableTarget=money(payload.refund_amount ?? request.approved_amount);
        if(refundableTarget<0||refundableTarget>money(request.approved_amount)) throw fail("Refund amount cannot exceed the inspected approved amount.");
        let remaining=refundRequested?refundableTarget:0;
        let refunded=0;
        let paymentSummary=null;
        if(remaining>0){
            const [payments]=await connection.query(
                `SELECT * FROM payment_transactions WHERE order_id=? AND status IN ('Paid','Partially Refunded') ORDER BY paid_at DESC,id DESC FOR UPDATE`,[request.order_id]
            );
            for(const payment of payments){
                if(remaining<=0) break;
                const available=money(Number(payment.amount)-Number(payment.refunded_amount||0));
                if(available<=0) continue;
                const amount=Math.min(available,remaining);
                const [r]=await connection.query(
                    `INSERT INTO payment_refunds(payment_transaction_id,order_id,amount,reason,status,refunded_by,completed_at)
                     VALUES(?,?,?,'Customer return','Completed',?,CURRENT_TIMESTAMP)`,[payment.id,request.order_id,amount,adminId]
                );
                await connection.query(`UPDATE payment_refunds SET refund_number=? WHERE id=?`,[makeNumber("REF",r.insertId),r.insertId]);
                const newRefunded=money(Number(payment.refunded_amount||0)+amount);
                await connection.query(`UPDATE payment_transactions SET refunded_amount=?,status=? WHERE id=?`,
                    [newRefunded,newRefunded>=money(payment.amount)?"Refunded":"Partially Refunded",payment.id]);
                remaining=money(remaining-amount); refunded=money(refunded+amount);
            }
            if(remaining>0) throw fail(`Only PKR ${refunded.toFixed(2)} is currently refundable from recorded paid transactions.`,409);
            paymentSummary =
                await updateOrderPaymentSummary(
                    connection,
                    request.order_id
                );
        }

        const orderFullyRefunded =
            String(
                paymentSummary?.payment_status ||
                ""
            ).toLowerCase() === "refunded";

        let salesSync=null;

        if(refunded>0){
            salesSync =
                await orderSalesIntegrationService
                    .syncOrderPaymentToSale(
                        connection,
                        request.order_id
                    );
        }

        const finalStatus=refunded>0?"Refunded":"Completed";
        await connection.query(
            `UPDATE customer_return_requests SET status=?,refund_amount=?,completed_at=CURRENT_TIMESTAMP,refunded_at=CASE WHEN ?>0 THEN CURRENT_TIMESTAMP ELSE refunded_at END WHERE id=?`,
            [finalStatus,refunded,refunded,returnId]
        );
        await connection.query(`UPDATE customer_return_items SET item_status=? WHERE return_request_id=?`,[finalStatus,returnId]);
        if(orderFullyRefunded) {
            await connection.query(
                `UPDATE orders
                 SET order_status='Refunded',
                     refunded_at=COALESCE(
                         refunded_at,
                         CURRENT_TIMESTAMP
                     )
                 WHERE id=?`,
                [request.order_id]
            );
        }
        await addActivity(connection,{returnRequestId:returnId,actorType:"Admin",actorId:adminId,action:refunded>0?"Return completed and refund issued":"Return completed",fromStatus:"Inspected",toStatus:finalStatus,notes:payload.notes});
        await connection.commit();

        let loyaltyReversal=null;
        let loyaltyWarning=null;

        if(
            orderFullyRefunded &&
            salesSync?.linked &&
            salesSync?.saleId
        ){
            try{
                loyaltyReversal =
                    await customerLoyaltyService
                        .reverseSalePoints(
                            salesSync.saleId,
                            `Website order ${request.order_id} fully refunded through customer return`
                        );
            }catch(error){
                if(Number(error.statusCode)===404){
                    loyaltyReversal={
                        success:true,
                        pointsReversed:0,
                        message:
                            "No purchase loyalty points had been awarded for this sale."
                    };
                }else{
                    console.error(
                        "Return loyalty reversal failed:",
                        error
                    );

                    loyaltyWarning =
                        error.message ||
                        "Return completed, but loyalty reversal requires review.";
                }
            }
        }

        return {
            id:returnId,
            status:finalStatus,
            refund_amount:refunded,
            restocked:restock,
            paymentSummary,
            orderFullyRefunded,
            salesSync,
            loyaltyReversal,
            loyaltyWarning
        };
    }catch(error){await rollbackQuietly(connection);throw error;}finally{connection.release();}
};

exports.RETURN_WINDOW_DAYS = RETURN_WINDOW_DAYS;
