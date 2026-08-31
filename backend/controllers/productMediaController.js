"use strict";
const fs = require("fs");
const path = require("path");
const db = require("../config/db");
const productMediaService = require("../services/productMediaService");

const PLACEHOLDERS = Array.from({ length: 10 }, (_, index) => {
    const number = String(index + 1).padStart(2, "0");
    return {
        id: `placeholder-${number}`,
        image_url: `/store/images/product-placeholders/product-placeholder-${number}.svg`,
        image_alt: `RUKHNAV product gallery placeholder ${index + 1}`,
        sort_order: index,
        is_primary: index === 0,
        is_placeholder: true
    };
});

function validId(value) {
    const id = Number.parseInt(value, 10);
    return Number.isInteger(id) && id > 0 ? id : null;
}
function clean(value, max = 500) {
    return String(value || "").trim().slice(0, max);
}
async function productExists(productId) {
    const [rows] = await db.query("SELECT id FROM products WHERE id = ? LIMIT 1", [productId]);
    return rows.length > 0;
}

exports.getPublicGallery = async (
    req,
    res
) => {
    try {
        const productId =
            validId(
                req.params.productId
            );

        if (!productId) {
            return res.status(400).json({
                success: false,
                message:
                    "A valid product ID is required."
            });
        }

        if (
            !await productExists(
                productId
            )
        ) {
            return res.status(404).json({
                success: false,
                message:
                    "Product not found."
            });
        }

        const images =
            await productMediaService
                .getProductImages(
                    productId
                );

        return res.json({
            success: true,
            source:
                images.length
                    ? "database"
                    : "placeholders",
            images:
                images.length
                    ? images
                    : PLACEHOLDERS
        });
    } catch (error) {
        console.error(
            "Public product gallery error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to load product gallery."
        });
    }
};

exports.getAdminGallery = async (
    req,
    res
) => {
    try {
        const productId =
            validId(
                req.params.productId
            );

        if (!productId) {
            return res.status(400).json({
                success: false,
                message:
                    "A valid product ID is required."
            });
        }

        const images =
            await productMediaService
                .getProductImages(
                    productId
                );

        return res.json({
            success: true,
            images
        });
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            success: false,
            message:
                "Unable to load product media."
        });
    }
};

exports.uploadImages = async (req, res) => {
    const connection = await db.getConnection();
    try {
        const productId = validId(req.params.productId);
        if (!productId) return res.status(400).json({success:false,message:"A valid product ID is required."});
        const files = Array.isArray(req.files) ? req.files : [];
        if (!files.length) return res.status(400).json({success:false,message:"Select at least one image."});
        await connection.beginTransaction();
        const [[countRow]] = await connection.query("SELECT COUNT(*) total FROM product_images WHERE product_id=?",[productId]);
        let order = Number(countRow.total || 0);
        const created=[];
        for (const file of files) {
            const imageUrl=`/uploads/products/gallery/${file.filename}`;
            const [result]=await connection.query(`INSERT INTO product_images(product_id,image_url,image_alt,sort_order,is_primary,status) VALUES(?,?,?,?,?, 'Active')`,[productId,imageUrl,clean(req.body.image_alt,200)||null,order,order===0?1:0]);
            created.push({id:result.insertId,image_url:imageUrl,sort_order:order,is_primary:order===0});
            order += 1;
        }
        await connection.commit();
        return res.status(201).json({success:true,message:"Product images uploaded successfully.",images:created});
    } catch(error) {
        await connection.rollback();
        console.error(error);
        return res.status(500).json({success:false,message:"Unable to upload product images."});
    } finally { connection.release(); }
};

exports.updateImage = async (req,res)=>{
    const imageId=validId(req.params.imageId);
    if(!imageId) return res.status(400).json({success:false,message:"A valid image ID is required."});
    try {
        const status=["Active","Inactive"].includes(req.body.status)?req.body.status:"Active";
        const sortOrder=Math.max(0,Number.parseInt(req.body.sort_order,10)||0);
        await db.query("UPDATE product_images SET image_alt=?, sort_order=?, status=? WHERE id=?",[clean(req.body.image_alt,200)||null,sortOrder,status,imageId]);
        return res.json({success:true,message:"Product image updated."});
    } catch(error){console.error(error);return res.status(500).json({success:false,message:"Unable to update image."});}
};

exports.setPrimary = async (req,res)=>{
    const connection=await db.getConnection();
    try {
        const imageId=validId(req.params.imageId);
        if(!imageId) return res.status(400).json({success:false,message:"A valid image ID is required."});
        await connection.beginTransaction();
        const [rows]=await connection.query("SELECT product_id FROM product_images WHERE id=? LIMIT 1 FOR UPDATE",[imageId]);
        if(!rows.length){await connection.rollback();return res.status(404).json({success:false,message:"Image not found."});}
        await connection.query("UPDATE product_images SET is_primary=0 WHERE product_id=?",[rows[0].product_id]);
        await connection.query("UPDATE product_images SET is_primary=1,status='Active' WHERE id=?",[imageId]);
        await connection.commit();
        return res.json({success:true,message:"Primary product image updated."});
    } catch(error){await connection.rollback();console.error(error);return res.status(500).json({success:false,message:"Unable to set primary image."});} finally{connection.release();}
};

exports.deleteImage = async (req,res)=>{
    try {
        const imageId=validId(req.params.imageId);
        if(!imageId) return res.status(400).json({success:false,message:"A valid image ID is required."});
        const [rows]=await db.query("SELECT image_url,product_id,is_primary FROM product_images WHERE id=? LIMIT 1",[imageId]);
        if(!rows.length) return res.status(404).json({success:false,message:"Image not found."});
        await db.query("DELETE FROM product_images WHERE id=?",[imageId]);
        const relative=String(rows[0].image_url||"").replace(/^\/+/,"");
        const filePath=path.join(process.cwd(),"public",relative);
        if(relative.startsWith("uploads/products/gallery/") && fs.existsSync(filePath)) fs.unlinkSync(filePath);
        if(rows[0].is_primary){
            const [next]=await db.query("SELECT id FROM product_images WHERE product_id=? ORDER BY sort_order,id LIMIT 1",[rows[0].product_id]);
            if(next.length) await db.query("UPDATE product_images SET is_primary=1 WHERE id=?",[next[0].id]);
        }
        return res.json({success:true,message:"Product image deleted."});
    } catch(error){console.error(error);return res.status(500).json({success:false,message:"Unable to delete image."});}
};
