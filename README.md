# 🖨️ BlackEyes Printing Press Management System

A full-stack web-based management system designed to digitalize and simplify the daily operations of **BlackEyes Printing Press**.

The platform brings together **online ordering, walk-in sales, inventory management, wholesale pricing, production tracking, vendor management, payments, invoicing, reporting, and AI-assisted features** in one centralized system.

---

## 📌 Project Overview

Printing presses often manage customer orders, inventory, payments, vendor bills, production jobs, and invoices through separate or manual processes.

The **BlackEyes Printing Press Management System** provides a centralized digital solution where:

- Customers can browse products and place printing orders online.
- Wholesale buyers can create accounts and receive special wholesale prices.
- Staff can create and manage walk-in orders.
- Admins can manage products, pricing, inventory, users, vendors, and reports.
- Production jobs can be tracked through different stages.
- Vendor invoices can be processed using OCR.
- Business records can be searched using semantic smart search.

The goal is to reduce manual work, improve organization, and make printing press operations easier to manage.

---

## 🎯 Main Objectives

- Digitalize printing press operations.
- Provide online ordering for customers.
- Support special pricing for wholesale buyers.
- Simplify walk-in order processing.
- Track printing jobs from order creation to completion.
- Manage raw materials and inventory.
- Track customer debts and vendor balances.
- Generate invoices and receipts.
- Provide useful business reports.
- Reduce manual invoice entry using OCR.
- Improve record searching using AI-assisted semantic search.

---

# 👥 User Roles

The system uses **role-based access control** to provide different functionality depending on the type of user.

## 👑 Admin

The administrator has full access to the system.

The admin can:

- Manage products.
- Set standard customer prices.
- Set wholesale prices.
- Manage inventory.
- Manage customers and wholesale buyers.
- Identify wholesale accounts.
- Manage staff accounts and permissions.
- View and review all orders.
- Manage vendors.
- Track customer debts.
- Track vendor balances.
- Generate invoices and receipts.
- View reports and analytics.
- Access AI-assisted features.

---

## 👷 Staff / Press Worker

Staff members handle the operational side of the printing press.

They can:

- Create walk-in orders.
- Create custom printing orders.
- View online and walk-in orders.
- Review customer orders.
- Update production statuses.
- Record payments.
- Handle customer credit and debts.
- Manage vendor transactions according to their permissions.
- Generate and print invoices and receipts.

---

## 👤 Customer

Regular customers can:

- Create an account.
- Log in securely.
- Browse available printing products.
- View standard product prices.
- Select quantities.
- Upload a design file.
- Provide a description when no design file is available.
- Place online orders.
- Pay online.
- Track their orders.
- View their order history.

---

## 🏢 Wholesale Buyer

Businesses and customers purchasing printing products in larger quantities can register as **Wholesale Buyers**.

Wholesale buyers can:

- Create a wholesale account.
- Log in to the platform.
- Browse available printing products.
- Receive special wholesale prices.
- Place orders using wholesale pricing.
- Upload design files.
- Add order descriptions.
- Pay online.
- Track their orders.
- View their previous orders.

When a wholesale buyer is authenticated, the system automatically applies the **wholesale price** configured for the selected product.

Admin and staff can also identify wholesale buyers when viewing customer accounts.

---

# ✨ Core Features

## 📦 Inventory & Stock Management

The inventory module tracks printing materials such as:

- Paper
- Ink
- Printing consumables
- Other raw materials

Stock is increased when materials are purchased or received and deducted according to completed orders.

The system also provides **low-stock alerts** when materials reach their configured minimum levels.

---

## 🛒 Online Ordering

Customers can order printing services directly through the website.

The ordering process allows users to:

1. Select a product.
2. Choose the required quantity.
3. Upload a design file if available.
4. Enter a description if no design file is uploaded.
5. Review the calculated price.
6. Complete the payment.
7. Submit the order.

If a design file is uploaded, it is manually reviewed by staff before production.

---

## 🏪 Point of Sale & Walk-In Orders

Staff can create orders for customers who visit the printing press physically.

Staff can:

- Select the customer.
- Select products.
- Enter quantities.
- Calculate the order total.
- Record cash payments.
- Record approved customer credit.
- Generate invoices or receipts.

---

## 🏷️ Standard & Wholesale Pricing

Each product can contain different prices for different customer types.

For example:

| Customer Type | Applied Price |
|---|---|
| Regular Customer | Standard Price |
| Wholesale Buyer | Wholesale Price |

The correct price is automatically selected according to the authenticated user's account type.

This allows BlackEyes Printing Press to offer dedicated pricing to wholesale customers without manually changing prices for every order.

---

## 🖼️ Product Catalog Management

The administrator can create and maintain the printing product catalog.

Each product can contain:

- Product name
- Standard price
- Wholesale price
- Optional product image
- System-generated product ID

Products can also be edited or retired when they are no longer offered.

---

## ⚙️ Production Workflow

Orders are tracked using a **Kanban-style production workflow**.

### Production Stages

```text
Queued
   ↓
In Prepress
   ↓
Printing
   ↓
Finishing
   ↓
Ready for Pickup
```

Staff update the order status as the printing job progresses.

This provides a clear view of all active jobs and their current production stage.

---

## 📝 Generic / Custom Orders

Not every printing job matches an existing catalog product.

Staff can therefore create **custom orders** for special requests.

Examples include:

- Plexiglass or acrylic cutting
- Custom signage
- Special printing jobs
- Customer-supplied materials
- Other custom services

Staff can manually enter:

- Service description
- Customer
- Quantity
- Price
- Notes
- Related files

The custom order then follows the normal payment and production workflow.

---

# 💳 Payments

The platform supports different payment methods depending on the order type.

### Online Orders

Online customers can pay using:

- **Whish Money**

### Walk-In Orders

Staff can record:

- Cash payments
- Approved customer credit

The payment status is stored with each order.

---

# 🧾 Invoices & Receipts

Admin and staff can review orders and generate formal invoices or receipts.

Generated documents can contain:

- Customer information
- Order information
- Products/services
- Quantities
- Prices
- Total amount
- Payment status

Invoices and receipts can be printed or provided digitally.

---

# 💰 Customer Credit & Debt Tracking

The system supports trusted customers who purchase services on credit.

Each credit transaction is associated with the customer's account.

Admin and staff can:

- View outstanding balances.
- Record customer debts.
- Record settlements.
- Monitor unpaid transactions.

---

# 🚚 Vendor Management

The system maintains financial records for printing press suppliers.

Admin and authorized staff can:

- Manage vendors.
- Record purchases.
- Record vendor invoices.
- Track paid and unpaid bills.
- Monitor outstanding vendor balances.

---

# 🤖 AI-Powered Features

The system integrates open-source AI-assisted technologies to automate repetitive tasks and improve information retrieval.

## 📄 Automated Vendor Invoice Parser

### Technology

**Tesseract OCR**

Instead of manually entering all information from vendor invoices, staff can upload a scanned invoice or invoice image.

```text
Vendor Invoice
      ↓
Image / Scan Upload
      ↓
Tesseract OCR
      ↓
Text Extraction
      ↓
Staff Review
      ↓
Vendor Ledger
```

OCR can extract readable information such as:

- Vendor information
- Items
- Quantities
- Prices
- Totals

The extracted information can then be reviewed before being stored.

### Benefits

- Reduces repetitive data entry.
- Saves staff time.
- Helps digitize paper invoices.
- Reduces manual transcription.

---

## 🔎 Semantic Smart Search & Tagging

The system also supports semantic searching using **open-source sentence-transformer embedding models**.

Traditional search usually requires users to enter exact keywords.

Semantic search allows the system to understand the meaning of a search query and find related records.

It can help search through:

- Products
- Historical invoices
- Business records
- Other searchable system information

---

# 📊 Dashboard & Reports

The admin dashboard provides information about printing press operations.

Reports can include:

- Sales activity
- Best-selling products
- Best-selling services
- Stock usage
- Fast-moving materials
- Customer purchasing activity
- Outstanding customer balances
- Outstanding vendor balances
- Operational information

These reports help management understand business activity and make informed decisions.

---

# 🛠️ Technology Stack

## Frontend

- ⚛️ **React**
- 🎨 **Bootstrap**
- 🎨 **CSS**

React is used to create the customer storefront, dashboards, forms, order pages, inventory views, and other interactive interfaces.

---

## Backend

- 🐍 **Python**
- ⚡ **FastAPI**

FastAPI provides the REST API and handles:

- Authentication
- Authorization
- Business logic
- Product management
- Order processing
- Pricing
- Inventory operations
- Reporting
- AI/OCR endpoints

---

## Database

- 🐘 **PostgreSQL**

PostgreSQL stores structured system data including:

- Users
- Customers
- Wholesale buyers
- Staff
- Products
- Orders
- Order items
- Inventory
- Vendors
- Payments
- Debts
- Invoices
- Production statuses

---

## AI / OCR

- 🤖 **Tesseract OCR**
- 🧠 **Open-source NLP models**
- 🔍 **Sentence-Transformer Embeddings**

---

## Development & Version Control

- Git
- GitHub

---

# 🏗️ System Architecture

```text
                    ┌─────────────────────┐
                    │        Users        │
                    │                     │
                    │ Customer            │
                    │ Wholesale Buyer     │
                    │ Staff               │
                    │ Admin               │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │    React Frontend   │
                    │ Bootstrap + CSS     │
                    └──────────┬──────────┘
                               │
                            REST API
                               │
                               ▼
                    ┌─────────────────────┐
                    │   FastAPI Backend   │
                    │                     │
                    │ Business Logic      │
                    │ Authentication      │
                    │ Pricing             │
                    │ Orders              │
                    │ Inventory           │
                    │ Reports             │
                    └──────────┬──────────┘
                               │
                 ┌─────────────┼─────────────┐
                 │             │             │
                 ▼             ▼             ▼
          ┌────────────┐ ┌───────────┐ ┌─────────────┐
          │ PostgreSQL │ │ Tesseract │ │ NLP /       │
          │ Database   │ │ OCR       │ │ Embeddings  │
          └────────────┘ └───────────┘ └─────────────┘
```

---

# 🔄 Main System Workflow

```text
Customer / Wholesale Buyer
          ↓
Create Account / Login
          ↓
Browse Printing Products
          ↓
Select Product & Quantity
          ↓
System Determines Price
          ↓
┌─────────────────────┬─────────────────────┐
│ Regular Customer    │ Wholesale Buyer     │
│ Standard Price      │ Wholesale Price     │
└─────────────────────┴─────────────────────┘
          ↓
Upload Design
OR
Enter Description
          ↓
Review Order
          ↓
Payment
          ↓
Staff Reviews Order
          ↓
Queued
          ↓
Prepress
          ↓
Printing
          ↓
Finishing
          ↓
Ready for Pickup
          ↓
Invoice / Receipt
```

Walk-in customers follow a similar process, but the order is created by staff through the POS system.

---

# 🔐 Security & Access Control

The platform uses role-based access control to protect administrative and operational functionality.

The main roles are:

```text
Admin
Staff
Customer
Wholesale Buyer
```

Users can only access functionality allowed for their role.

This helps protect sensitive functionality such as:

- Product pricing
- Inventory management
- Vendor records
- Financial records
- Staff management
- Reports
- Administrative operations

---

# 📱 Responsive Design

The interface is designed using **React, Bootstrap, and CSS** to support different screen sizes.

The system can be accessed through:

- 💻 Desktop computers
- 💻 Laptops
- 📱 Mobile devices
- 📱 Tablets

---

# 🚀 Future Improvements

Possible future enhancements include:

- 📱 Dedicated mobile application
- 📊 More advanced business analytics
- 🤖 Improved OCR accuracy
- 🧠 More advanced AI models
- 🔔 Customer order-status notifications
- 📧 Email notifications
- 🌐 Multi-language support
- ☁️ Improved cloud scalability
- 📈 Advanced sales forecasting
- 📦 More advanced inventory analytics

---

# 🌍 Business Impact

The BlackEyes Printing Press Management System helps transform traditional printing press operations into a centralized digital workflow.

The platform aims to:

- Reduce manual administrative work.
- Improve order organization.
- Simplify wholesale pricing.
- Improve inventory visibility.
- Track production more clearly.
- Reduce vendor invoice data entry.
- Centralize financial records.
- Improve customer ordering.
- Provide management with useful operational reports.

---

# 📁 Project Structure

The exact folder structure depends on the final implementation, but the project follows a frontend/backend architecture similar to:

```text
BlackEyes/
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── assets/
│   │   └── App.jsx
│   │
│   └── package.json
│
├── backend/
│   ├── routes/
│   ├── models/
│   ├── schemas/
│   ├── services/
│   ├── database/
│   ├── ai/
│   └── main.py
│
└── README.md
```

---

# ⚙️ Installation

## 1. Clone the Repository

```bash
git clone <your-repository-url>
cd <project-folder>
```

## 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

## 3. Backend Setup

Create and activate a Python virtual environment.

### Windows

```bash
cd backend

python -m venv venv

venv\Scripts\activate
```

Install the required packages:

```bash
pip install -r requirements.txt
```

Run FastAPI:

```bash
uvicorn main:app --reload
```

## 4. Environment Variables

Create the required environment configuration for your database, authentication, payment integration, and other services.

> ⚠️ Never commit `.env` files, database passwords, secret keys, API credentials, or authentication secrets to GitHub.

---

# 👩‍💻 Project

**BlackEyes Printing Press Management System**

Developed as a full-stack web application for managing the digital and operational workflow of a professional printing press.

---

## 📄 License

This project was developed for educational and project purposes.
