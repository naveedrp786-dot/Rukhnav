# server.js patch

Add with the other route imports:

```js
const customerReturnRoutes = require("./routes/customerReturnRoutes");
const adminReturnRoutes = require("./routes/adminReturnRoutes");
```

Add before the 404 handler:

```js
app.use("/api/returns", customerReturnRoutes);
app.use("/api/admin/returns", adminReturnRoutes);
```
