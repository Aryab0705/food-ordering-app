# College Food Ordering System (Mini Zomato)

A real-world MERN stack project for campus food ordering with two roles:

- `Student`: register/login, browse menu, add to cart, place orders, track status
- `Vendor`: register/login, manage food items, view incoming orders, update order status

## Tech Stack

- Frontend: React + Vite + Hooks
- Backend: Node.js + Express
- Database: MongoDB + Mongoose
- Authentication: JWT
- Architecture: MVC on the backend with REST APIs

## Folder Structure

```text
Food_ordering_app/
├── client/
│   ├── src/
│   │   ├── api/
│   │   ├── components/
│   │   ├── hooks/
│   │   └── utils/
├── server/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── models/
│   │   ├── routes/
│   │   └── utils/
└── package.json
```

## Backend API Overview

### Auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`

### Food Items

- `GET /api/foods`
- `GET /api/foods/vendor`
- `POST /api/foods`
- `PUT /api/foods/:id`
- `DELETE /api/foods/:id`
- `POST /api/foods/seed`

### Cart

- `GET /api/cart`
- `POST /api/cart`
- `PUT /api/cart/:foodId`
- `DELETE /api/cart`

### Orders

- `POST /api/orders`
- `GET /api/orders/student`
- `GET /api/orders/vendor`
- `PUT /api/orders/:id/status`

## Setup

### 1. Install dependencies

```bash
npm install --prefix server
npm install --prefix client
```

### 2. Configure environment variables

Create these files from the examples:

- `server/.env`
- `client/.env`

Use:

```env
# server/.env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/college-food-ordering
JWT_SECRET=replace-with-a-strong-secret
CLIENT_URL=http://localhost:5173
```

```env
# client/.env
VITE_API_URL=http://localhost:5000/api
```

### 3. Run the project

In one terminal:

```bash
npm run server
```

In another terminal:

```bash
npm run client
```

## MongoDB Schema Design

### User

- `name`
- `email`
- `password`
- `role`
- `phone`
- `cart[]`

### FoodItem

- `name`
- `description`
- `category`
- `price`
- `imageUrl`
- `isAvailable`
- `vendor`

### Order

- `student`
- `items[]`
- `totalAmount`
- `status`

## Notes

- Vendors can seed a sample menu once to speed up demos.
- Order status flow is `pending -> preparing -> delivered`.
- The frontend stores the JWT session in local storage for a simple project setup.
