# Stake Invest – Investment Platform

## 📌 Overview
Stake Invest is a full-stack web application developed as a final academic project.
The system simulates a real estate investment platform, allowing users to explore,
filter, and analyze investment opportunities based on multiple criteria.

## 🧱 Project Structure

root/
│── backend/        # Node.js + Express + MongoDB (Mongoose)
│── frontend/       # HTML, CSS, Vanilla JavaScript
│── README.md
│── ARCHITECTURE.md
│── PROJECT_STRUCTURE.md
│── QUICKSTART.md
│── package.json


## ⚙️ Technologies
### Backend
- Node.js
- Express.js
- MongoDB Atlas (for users and investments only)
- Mongoose
- ATTOM API (for property data)
- Pexels API (for property images)

### Frontend
- HTML5
- CSS3
- JavaScript (Vanilla)
- Fetch API

## 🚀 Current Status
- ✅ Backend connected to MongoDB (users and investments only)
- ✅ Properties API integrated with ATTOM
- ✅ Image integration with Pexels API
- ✅ Frontend base structure initialized
- ✅ Property search by address (address1 + address2)

## 📦 Versioning
This project is developed incrementally.
Each major milestone is tracked as a Git version (tag).

- v0.1 – Initial project structure and base integration
- v0.2 – ATTOM API integration with Pexels images

## 🔑 Environment Variables

Create a `.env` file in the `backend/` directory with:

```env
MONGO_URI=your_mongodb_connection_string
ATTOM_BASE_URL=https://api.gateway.attomdata.com/propertyapi/v1.0.0
ATTOM_API_KEY=your_attom_api_key
PEXELS_API_KEY=your_pexels_api_key
```

**Note:** The server will log warnings if API keys are missing, but will continue to run (images may be null without Pexels key).

## 📄 Documentation
- `ARCHITECTURE.md` – System architecture
- `PROJECT_STRUCTURE.md` – Folder responsibilities
- `QUICKSTART.md` – Setup and run instructions

## 🧪 Testing

### Test ATTOM API (PowerShell)

Test property detail endpoint:

```powershell
$headers = @{
    "accept" = "application/json"
    "apikey" = "YOUR_ATTOM_API_KEY"
}
$uri = "https://api.gateway.attomdata.com/propertyapi/v1.0.0/property/detail?address1=4529%20Winona%20Court&address2=Denver,%20CO"
Invoke-RestMethod -Uri $uri -Method Get -Headers $headers
```

### Test Backend API (curl)

Test the backend endpoint:

```bash
curl -X GET "http://localhost:3000/api/properties?address1=4529%20Winona%20Court&address2=Denver,%20CO" \
  -H "accept: application/json"
```

## 👤 Author
Jawad Kadry  
Final Project – Full Stack Development
