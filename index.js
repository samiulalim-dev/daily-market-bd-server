const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const admin = require("firebase-admin");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 5000;
const decodedKey = Buffer.from(process.env.FB_SERVICE_KEY, "base64").toString();
const serviceAccount = JSON.parse(decodedKey);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.fe99gj2.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const verifyFirebaseToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized: No token provided" });
  }
  const token = authHeader.split(" ")[1];
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.decoded = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ message: "Forbidden: Invalid token" });
  }
};

async function run() {
  try {
    const database = client.db("dailyMarketDB");
    const usersCollection = database.collection("users");
    const productsCollection = database.collection("products");
    const advertisementsCollection = database.collection("advertisements");
    const reviewsCollection = database.collection("reviews");
    const watchlistCollection = database.collection("watchlist");

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const user = await usersCollection.findOne({ email });

      if (user?.role !== "admin") {
        return res.status(401).send({ error: true, message: "Forbidden" });
      }

      next();
    };
    const verifyVendor = async (req, res, next) => {
      const email = req.decoded.email;
      const user = await usersCollection.findOne({ email });

      if (user?.role !== "vendor") {
        return res.status(401).send({ error: true, message: "Forbidden" });
      }

      next();
    };
    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const user = await usersCollection.findOne({ email: email });
      res.send({ role: user?.role || "user" });
    });

    // get all users
    app.get("/users", verifyFirebaseToken, verifyAdmin, async (req, res) => {
      const search = req.query.search || "";
      const query = {
        $or: [
          { name: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
        ],
      };
      const users = await usersCollection.find(query).toArray();
      res.send(users);
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      const existingUser = await usersCollection.findOne({ email: user.email });

      if (existingUser) {
        return res.status(200).send({ message: "User already exists" });
      }

      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    app.patch(
      "/users/role/:id",
      verifyFirebaseToken,
      verifyAdmin,
      async (req, res) => {
        const userId = req.params.id;
        const { role } = req.body;

        if (!role) {
          return res.status(400).json({ error: "Role is required" });
        }

        try {
          const result = await usersCollection.updateOne(
            { _id: new ObjectId(userId) },
            { $set: { role } }
          );
          res.send(result);
        } catch (error) {
          console.error("Error updating role:", error);
          res.status(500).json({ error: "Internal Server Error" });
        }
      }
    );

    //  productsCollection

    app.get(
      "/vendor/products",
      verifyFirebaseToken,
      verifyVendor,
      async (req, res) => {
        const email = req.query.email;
        if (!email) {
          return res.status(400).send({ message: "Email is required" });
        }
        const products = await productsCollection
          .find({ vendorEmail: email })
          .sort({ date: -1 })
          .toArray();

        res.send(products);
      }
    );

    app.post(
      "/products",
      verifyFirebaseToken,
      verifyVendor,
      async (req, res) => {
        try {
          const product = req.body;
          const result = await productsCollection.insertOne(product);
          res.send(result);
        } catch (err) {
          res
            .status(500)
            .send({ message: "Failed to add product", error: err.message });
        }
      }
    );
    app.patch("/products/:id", async (req, res) => {
      const id = req.params.id;
      const updatedData = req.body;

      const result = await productsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updatedData }
      );
      res.send(result);
    });

    app.delete(
      "/products/:id",
      verifyFirebaseToken,
      verifyVendor,
      async (req, res) => {
        const id = req.params.id;
        console.log(id);
        const result = await productsCollection.deleteOne({
          _id: new ObjectId(id),
        });
        res.send(result);
      }
    );

    // advertisementsCollection

    app.get("/advertisements", async (req, res) => {
      const email = req.query.vendorEmails;
      const result = await advertisementsCollection
        .find({ vendorEmail: email })
        .toArray();
      res.send(result);
    });

    app.post(
      "/advertisements",
      verifyFirebaseToken,
      verifyVendor,
      async (req, res) => {
        const adData = req.body;
        try {
          const result = await advertisementsCollection.insertOne(adData);
          res.send(result);
        } catch (err) {
          res
            .status(500)
            .send({ message: "Failed to add advertisement", error: err });
        }
      }
    );

    //  update advertisement by id
    app.patch(
      "/advertisements/:id",
      verifyFirebaseToken,
      verifyVendor,
      async (req, res) => {
        const id = req.params.id;
        const updatedData = req.body;

        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: updatedData,
        };

        const result = await advertisementsCollection.updateOne(
          filter,
          updateDoc
        );
        res.send(result);
      }
    );
    //  delete advertisement by id
    app.delete(
      "/advertisements/:id",
      verifyFirebaseToken,
      verifyVendor,
      async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await advertisementsCollection.deleteOne(query);
        res.send(result);
      }
    );

    // admin all product
    app.get(
      "/admin/products",
      verifyFirebaseToken,
      verifyAdmin,
      async (req, res) => {
        const result = await productsCollection
          .find()
          .sort({ date: -1 })
          .toArray();
        res.send(result);
      }
    );

    // handle approved

    app.patch(
      "/admin/products/approve/:id",
      verifyFirebaseToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const result = await productsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { status: "approved", rejectedReason: "" } }
        );
        res.send(result);
      }
    );

    // Reject a product with reason
    app.patch(
      "/admin/products/reject/:id",
      verifyFirebaseToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const { reason } = req.body;
        const result = await productsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { status: "rejected", rejectedReason: reason } }
        );
        res.send(result);
      }
    );

    // Delete a product
    app.delete(
      "/admin/products/:id",
      verifyFirebaseToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const result = await productsCollection.deleteOne({
          _id: new ObjectId(id),
        });
        res.send(result);
      }
    );

    // admin all advertisements
    app.get(
      "/admin/advertisements",
      verifyFirebaseToken,
      verifyAdmin,
      async (req, res) => {
        const result = await advertisementsCollection
          .find()
          .sort({ createdAt: -1 })
          .toArray();
        res.send(result);
      }
    );
    // Update Advertisement Status
    app.patch("/admin/advertisements/:id", async (req, res) => {
      const id = req.params.id;
      const { status } = req.body;
      // console.log(id, status);
      const result = await advertisementsCollection.updateOne(
        { _id: new ObjectId(id) },
        {
          $set: { status },
        }
      );
      res.send(result);
    });

    // delete advertisements

    app.delete("/admin/advertisements/:id", async (req, res) => {
      const id = req.params.id;
      const result = await advertisementsCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    });

    // approved advertisements

    app.get("/approved/advertisements", async (req, res) => {
      const result = await advertisementsCollection
        .find({
          status: "approved",
        })
        .toArray();
      res.send(result);
    });

    // get all approved products

    app.get("/products/public", async (req, res) => {
      try {
        const { sort, startDate, endDate } = req.query;

        // Step 1: Build match query
        const matchQuery = {
          status: "approved",
        };

        if (startDate && endDate) {
          matchQuery.date = {
            $gte: startDate,
            $lte: endDate,
          };
        }

        // Step 2: Determine sort option
        let sortStage = { date: -1 };

        if (sort === "asc") {
          sortStage = { priceNumber: 1 };
        } else if (sort === "desc") {
          sortStage = { priceNumber: -1 };
        }

        // Step 3: Aggregate query with $toDouble for pricePerUnit
        const products = await productsCollection
          .aggregate([
            {
              $match: matchQuery,
            },
            {
              $addFields: {
                priceNumber: { $toDouble: "$pricePerUnit" },
              },
            },
            {
              $sort: sortStage,
            },
          ])
          .toArray();

        res.send(products);
      } catch (error) {
        res.status(500).json({ message: "Server Error", error: error.message });
      }
    });

    // get a single products

    app.get("/products/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const product = await productsCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!product) {
          return res.status(404).json({ message: "Product not found" });
        }

        res.send(product);
      } catch (error) {
        res
          .status(500)
          .send({ message: "Something went wrong", error: error.message });
      }
    });

    // app.get("/price-history/:id", async (req, res) => {
    //   try {
    //     const id = req.params.id;
    //     const compareDate = req.query.compareDate;

    //     if (!compareDate) {
    //       return res.status(400).json({ message: "Compare date is required" });
    //     }

    //     const currentProduct = await productsCollection.findOne({
    //       _id: new ObjectId(id),
    //     });

    //     if (!currentProduct) {
    //       return res.status(404).json({ message: "Product not found" });
    //     }

    //     const previousProduct = await productsCollection.findOne({
    //       marketName: currentProduct.marketName,
    //       date: compareDate,
    //       "products.name": { $in: currentProduct.map((p) => p.name) },
    //     });

    //     if (!previousProduct) {
    //       return res
    //         .status(404)
    //         .json({ message: "Previous product data not found" });
    //     }

    //     const comparison = currentProduct.map((currItem) => {
    //       const prevItem = previousProduct.find(
    //         (p) => p.name === currItem.name
    //       );
    //       const previousPrice = prevItem ? prevItem.pricePerUnit : 0;
    //       return {
    //         name: currItem.itemName,
    //         current: currItem.pricePerUnit,
    //         previous: previousPrice,
    //         difference: currItem.pricePerUnit - previousPrice,
    //       };
    //     });

    //     res.send(comparison);
    //   } catch (error) {
    //     console.error("Error fetching price history:", error);
    //     res.status(500).json({ message: "Internal Server Error" });
    //   }
    // });

    // app.get("/price-history/:id", async (req, res) => {
    //   try {
    //     const id = req.params.id;
    //     const compareDate = req.query.compareDate;

    //     if (!compareDate) {
    //       return res.status(400).json({ message: "Compare date is required" });
    //     }

    //     // Get current product document by ID
    //     const currentProduct = await productsCollection.findOne({
    //       _id: new ObjectId(id),
    //     });

    //     if (!currentProduct) {
    //       return res.status(404).json({ message: "Product not found" });
    //     }

    //     // Get previous product document by market name and compare date
    //     const previousProduct = await productsCollection.findOne({
    //       marketName: currentProduct.marketName,
    //       date: compareDate,
    //     });

    //     if (!previousProduct) {
    //       return res
    //         .status(404)
    //         .json({ message: "Previous product data not found" });
    //     }

    //     // Compare each product by name
    //     const comparison = currentProduct.products.map((currItem) => {
    //       const prevItem = previousProduct.products.find(
    //         (p) => p.name === currItem.name
    //       );

    //       const currentPrice = parseFloat(currItem.pricePerUnit) || 0;
    //       const previousPrice = parseFloat(prevItem?.pricePerUnit) || 0;

    //       return [
    //         {
    //           name: currItem.name,
    //           current: currentPrice,
    //           previous: previousPrice,
    //           difference: currentPrice - previousPrice,
    //         },
    //       ];
    //     });

    //     res.send(comparison);
    //   } catch (error) {
    //     console.error("Error fetching price history:", error);
    //     res.status(500).json({ message: "Internal Server Error" });
    //   }
    // });

    // app.get("/price-history/:id", verifyFirebaseToken, async (req, res) => {
    //   try {
    //     const id = req.params.id;
    //     const compareDate = req.query.compareDate;

    //     const product = await productsCollection.findOne({
    //       _id: new ObjectId(id),
    //     });

    //     if (!product) {
    //       return res.status(404).json({ message: "Product not found" });
    //     }

    //     const currentPrice = parseFloat(product.pricePerUnit);

    //     // compareDate
    //     const previousEntry = product.prices?.find(
    //       (p) => p.date === compareDate
    //     );
    //     const previousPrice = previousEntry
    //       ? parseFloat(previousEntry.price)
    //       : 0;

    //     const difference = parseFloat(
    //       (currentPrice - previousPrice).toFixed(2)
    //     );

    //     const chartData = [
    //       {
    //         name: product.itemName || "Item",
    //         current: currentPrice,
    //         previous: previousPrice,
    //         difference: difference,
    //       },
    //     ];

    //     res.send(chartData);
    //   } catch (err) {
    //     console.error(err);
    //     res.status(500).json({ message: "Something went wrong" });
    //   }
    // });

    // GET /price-history/:id?compareDate=YYYY-MM-DD
    app.get("/price-history/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const compareDate = req.query.compareDate;

        const product = await productsCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!product) {
          return res.status(404).json({ message: "Product not found" });
        }

        const currentPrice = parseFloat(product.pricePerUnit);
        const itemName = product.itemName || "Item";

        if (!compareDate) {
          // Only current price
          return res.send([
            {
              name: itemName,
              current: currentPrice,
            },
          ]);
        }

        const previousEntry = product.prices?.find(
          (p) => p.date === compareDate
        );
        const previousPrice = previousEntry
          ? parseFloat(previousEntry.price)
          : 0;

        const difference = parseFloat(
          (currentPrice - previousPrice).toFixed(2)
        );

        const chartData = [
          {
            name: itemName,
            current: currentPrice,
            previous: previousPrice,
            difference: difference,
          },
        ];

        res.send(chartData);
      } catch (error) {
        console.error("Error fetching chart data:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    // reviewsCollection CRUD

    app.get("/reviews/:productId", async (req, res) => {
      try {
        const productId = req.params.productId;

        const reviews = await reviewsCollection
          .find({ productId })
          .sort({ date: -1 })
          .toArray();

        res.send(reviews);
      } catch (error) {
        res.status(500).json({ message: "Failed to fetch reviews", error });
      }
    });

    app.post("/reviews", verifyFirebaseToken, async (req, res) => {
      try {
        const review = req.body;

        if (
          !review.productId ||
          !review.name ||
          !review.email ||
          !review.comment ||
          !review.rating
        ) {
          return res.status(400).json({ message: "All fields are required" });
        }
        const result = await reviewsCollection.insertOne(review);
        res.send(result);
      } catch (error) {
        res.status(500).json({ message: "Failed to post review", error });
      }
    });

    // watchList collection CRUD

    app.post("/watchlist", verifyFirebaseToken, async (req, res) => {
      try {
        const watchItem = req.body;

        // Prevent duplicate entry
        const existing = await watchlistCollection.findOne({
          userEmail: watchItem.userEmail,
          productId: watchItem.productId,
          productName: watchItem.itemName,
          marketName: watchItem.marketName,
        });

        if (existing) {
          return res.status(409).json({ message: "Already in watchlist" });
        }

        const result = await watchlistCollection.insertOne(watchItem);
        res.status(201).json(result);
      } catch (err) {
        res.status(500).json({ message: "Failed to add to watchlist" });
      }
    });

    app.get("/watchlist/:email", verifyFirebaseToken, async (req, res) => {
      try {
        const email = req.params.email;
        console.log(email);
        if (req.decoded.email !== email) {
          return res.status(403).json({ message: "Forbidden access" });
        }

        const items = await watchlistCollection
          .find({ userEmail: email })
          .toArray();
        res.send(items);
      } catch (err) {
        res.status(500).json({ message: "Failed to fetch watchlist" });
      }
    });

    app.delete("/watchlist/:id", verifyFirebaseToken, async (req, res) => {
      try {
        const id = req.params.id;
        const item = await watchlistCollection.findOne({
          productId: id,
        });

        if (!item) {
          return res.status(404).json({ message: "Item not found" });
        }

        if (item.userEmail !== req.decoded.email) {
          return res.status(403).json({ message: "Unauthorized" });
        }

        const result = await watchlistCollection.deleteOne({
          productId: id,
        });
        res.send(result);
      } catch (err) {
        res.status(500).json({ message: "Failed to remove item" });
      }
    });

    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("this is daily market bd server");
});

app.listen(port, () => {
  console.log(`daily market server listening on port ${port}`);
});
