# 🛠️ Daily Market BD - Backend

Backend server for the **Daily Market BD** application – a full-stack project that tracks local market product prices, manages vendors and orders, and displays price trends.

---

## 🌐 Live Server URL

> 🔗 `https://daily-market-bd-server.vercel.app/`

---

## 📦 Technologies Used

- **Node.js**
- **Express.js**
- **MongoDB (MongoDB Atlas)**
- **Firebase Admin SDK**
- **JWT (JSON Web Token)**
- **dotenv**
- **cors**


---

## 🔐 Authentication

- Firebase Authentication with Firebase Admin SDK.
- Role-based access control (User, Vendor, Admin).
- Protected routes using custom middleware (`verifyFirebaseToken`, `verifyAdmin`, etc).

---


---

## 🧪 Available Endpoints

### 🔐 Auth & Users
- `POST /jwt`: Generate JWT token after Firebase login.
- `GET /users`: Get all users (admin only).
- `PATCH /users/admin/:email`: Make admin.

### 🛍️ Products
- `GET /products`: Get all products.
- `POST /products`: Vendor adds new product.
- `PATCH /products/:id`: Update price or status.
- `GET /products/:id`: Get single product by ID.

### 📦 Orders
- `POST /orders`: Place an order.
- `GET /orders`: Admin or user can fetch orders.

### 📢 Advertisements
- `GET /ads`: Fetch all approved ads.
- `POST /ads`: Vendor adds ad.
- `PATCH /ads/:id`: Admin approves/rejects ad.

### 📈 Price Trends
- `GET /trends/:id`: Get price history of a product for charting.

---
