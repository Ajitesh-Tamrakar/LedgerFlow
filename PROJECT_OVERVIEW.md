# JBB Projects - Complete Project Overview

## 📋 Project Summary

**JBB Projects** is a comprehensive Django-based **Business Accounting and Management System** designed to manage daily business operations, track financial transactions, manage dealer relationships, and visualize business performance through interactive dashboards.

**Technology Stack:**
- **Backend:** Django 5.2.4 (Python)
- **Frontend:** HTML5, CSS3, JavaScript
- **Database:** PostgreSQL (AWS RDS)
- **Additional Libraries:** Django REST Framework, django-filters, django-widget-tweaks, Pillow
- **Deployment:** AWS Elastic Beanstalk ready

---

## 🗂️ Database Models Architecture

### 1. **DailyMoneyInputs Model**
Tracks daily financial collections from multiple payment sources.

```python
class DailyMoneyInputs(models.Model):
    id = AutoField (Primary Key)
    UPI = IntegerField
    cash = IntegerField
    cards = IntegerField
    date = DateField (unique)
    in_total = FloatField (default=0.0)
```

**Purpose:** Records daily revenue from UPI, cash, and card transactions.

**Business Logic:** 
- Unique date constraint ensures one record per day
- Automatically calculates total collection (in_total)

---

### 2. **Dealers Model**
Manages business party/supplier/dealer information.

```python
class Dealers(models.Model):
    id = AutoField (Primary Key)
    party_name = CharField(max_length=50)
    party_slug = SlugField (indexed)
    GST_num = CharField(max_length=15, optional)
    opening_balance = FloatField (default=0.0)
```

**Purpose:** Stores dealer/supplier information and tracks relationships.

**Features:**
- SEO-friendly slug generation
- GST number tracking for tax compliance
- Opening balance for migrating existing accounts

---

### 3. **Bills Model**
Manages bill/invoice documents from dealers.

```python
class Bills(models.Model):
    id = AutoField (Primary Key)
    bill_img = ImageField (upload_to='bill_images')
    bill_date = DateField
    dealer_id = ForeignKey(Dealers, CASCADE)
    bill_amount = FloatField
```

**Purpose:** Digital repository for bill images and amounts.

**Features:**
- Image upload support with Pillow
- Foreign key relationship with Dealers
- Cascade delete (if dealer deleted, bills also deleted)

---

### 4. **Payments Model**
Tracks all payments made to dealers.

```python
class Payments(models.Model):
    id = AutoField (Primary Key)
    dealer_id = ForeignKey(Dealers, CASCADE)
    payment_date = DateField
    payment_amount = FloatField
    payment_method = CharField(max_length=50)
```

**Purpose:** Records payment transactions to dealers.

**Features:**
- Multiple payment methods support
- Links payments to specific dealers
- Enables ledger calculation

---

### 5. **Tasklist Model**
Simple task management system for daily operations.

```python
class Tasklist(models.Model):
    id = AutoField (Primary Key)
    task = CharField(max_length=100)
    task_date = DateField (auto_now=True)
    task_status = BooleanField (default=False)
```

**Purpose:** To-do list for business tasks.

**Features:**
- Boolean status tracking (completed/pending)
- Automatic timestamp on creation

---

## 🔐 Authentication & Authorization

### Current Implementation:
- **Django Admin Authentication:** Built-in Django admin panel (`/admin`)
- **User Management:** Uses Django's default `User` model
- **Authentication Middleware:** `django.contrib.auth.middleware.AuthenticationMiddleware`
- **Password Validators:** 
  - UserAttributeSimilarityValidator
  - MinimumLengthValidator
  - CommonPasswordValidator
  - NumericPasswordValidator

### Security Configuration:
- PostgreSQL database hosted on AWS RDS
- Credentials stored in settings.py (⚠️ should be moved to environment variables)
- CSRF protection enabled
- Session management via Django sessions

### ⚠️ **Current Limitation:**
**No custom login system** - The application currently relies on Django admin authentication. Regular users cannot log in to the main application pages (dashboard, records, etc.). All views are publicly accessible without authentication checks.

### 🔧 **Recommended Enhancement:**
Implement user authentication for main application:
```python
# Add to views.py
from django.contrib.auth.decorators import login_required

@login_required
def dashboard(request):
    # existing code
```

---

## 🎯 Core Functionality

### 1. **Homepage** (`/`)
- **File:** `views.py::homepage()`
- **Template:** `index.html`
- **Purpose:** Landing page/welcome screen
- **Features:** Entry point to the application

---

### 2. **Dashboard** (`/dashboard/`)
- **File:** `views.py::dashboard()`
- **Template:** `dashboard.html`
- **Purpose:** Main business intelligence dashboard

#### Features:
**📊 Key Performance Indicators (KPIs):**
- Today's Profit (calculated as 20% of today's collection)
- Today's Total Collection (UPI + Cash + Cards)
- Bills Received Today (count)
- Outstanding Amounts

**📈 Data Visualizations:**
- **Daily Chart:** Last 7 days collection trends
- **Weekly Chart:** Weekly aggregated collections
- **Monthly Chart:** Monthly revenue patterns

**✅ Task Management:**
- Interactive to-do list
- Task completion tracking
- Real-time task updates

**Technical Implementation:**
```python
# Weekly data aggregation
week_trunc = DailyMoneyInputs.objects.annotate(
    week_start=TruncWeek('date')
).values('week_start').annotate(
    todays_collection=Sum('in_total')
).order_by('week_start')

# Monthly data aggregation
month_trunc = DailyMoneyInputs.objects.annotate(
    month_start=TruncMonth('date')
).values('month_start').annotate(
    months_collection=Sum('in_total')
).order_by('month_start')
```

---

### 3. **Daily Collection Input** (`/daily-collection/`)
- **File:** `views.py::daily_collection()`
- **Method:** POST
- **Purpose:** Record daily revenue

#### Features:
- Accepts UPI, Cash, and Card amounts
- Validates numeric inputs
- Calculates total automatically
- Unique date constraint prevents duplicates
- Redirects to dashboard on success

**Form Data:**
```json
{
  "upi": "5000",
  "cash": "3000",
  "card": "2000",
  "date": "2026-01-21"
}
```

---

### 4. **Records Page** (`/records/`)
- **File:** `views.py::record_page()`
- **Template:** `records.html`
- **Purpose:** Comprehensive records management hub

#### Features:

**📄 Bill Gallery:**
- Displays all uploaded bill images
- Filterable and searchable
- Lightbox view for images
- Shows dealer info, date, and amount

**👥 Party Management:**
- Add new dealers/suppliers
- GST number tracking
- Opening balance setup

**💳 Payment Recording:**
- Record payments to dealers
- Multiple payment methods
- Date tracking

**📚 Ledger Access:**
- Quick access to dealer ledgers
- Outstanding balance calculation

**🔍 Advanced Filtering:**
- Filter by dealer
- Amount range filter (>=)
- Date range filter (start_date to end_date)
- Real-time search

**📊 Top 3 Outstanding:**
- Shows top 3 dealers with highest outstanding balances
- Displays dealer name, GST number, and amount
- Calculated as: Total Bills - Total Payments

**Technical Implementation:**
```python
# Calculate outstanding balances
payments = Payments.objects.values('dealer_id').annotate(
    total_payments=Sum('payment_amount')
)
bill_amounts = Bills.objects.values('dealer_id').annotate(
    total_bill_amount=Sum('bill_amount')
)
ledger_balance = dict(Counter(bill_dict) - Counter(payment_dict))
```

---

### 5. **Create Party** (`/create-party/`)
- **File:** `views.py::create_party_page()`
- **Method:** POST
- **Purpose:** Add new dealers/suppliers

#### Process:
1. Accept party name, GST number, opening balance
2. Auto-generate slug from party name
3. Save to database
4. Redirect to records page

**Slug Generation:**
```python
party_slug = slugify(partyName)
# Example: "ABC Industries" → "abc-industries"
```

---

### 6. **Bill Upload** (`/bill-uploads/`)
- **File:** `views.py::bill_uploads()`
- **Method:** POST (multipart/form-data)
- **Purpose:** Upload and store bill images

#### Features:
- Image file upload
- Associates bill with dealer
- Records bill amount and date
- Stores in media directory (`uploads/bill_images/`)

**Storage:**
- Media files: `/uploads/bill_images/`
- Media URL: `/bill_imgs/`

---

### 7. **Payment Recording** (`/payments/`)
- **File:** `views.py::payments()`
- **Method:** POST
- **Purpose:** Record payments made to dealers

#### Features:
- Links payment to dealer
- Records payment date and amount
- Tracks payment method (cash/cheque/UPI/etc.)
- Error handling for invalid dealer IDs

---

### 8. **Ledger View** (`/ledger-view/<dealer_id>/`)
- **File:** `views.py::ledger()`
- **Template:** `test.html`
- **Purpose:** Detailed transaction history for a dealer

#### Features:

**📊 Ledger Information:**
- Dealer details (name, GST, opening balance)
- Complete transaction timeline
- Running balance calculation
- Bill count and payment count

**📝 Transaction Types:**
1. **Bills:** Increase outstanding (debit)
2. **Payments:** Decrease outstanding (credit)

**🔄 Chronological Sorting:**
- Transactions sorted by date (newest first)
- Combined view of bills and payments

**💰 Balance Calculation:**
```python
# Running balance logic
for each transaction:
    if Bill:
        ledger_balance += bill_amount  # Debit
    if Payment:
        ledger_balance -= payment_amount  # Credit
```

**Transaction Entry Format:**
```json
{
  "type": "Bill" or "Payment",
  "date": "2026-01-21",
  "amount": 5000,
  "desc": "payment_method (for payments)"
}
```

---

### 9. **Task List API** (`/task-list`)
- **File:** `views.py::task_list()`
- **Methods:** GET, POST, PATCH, DELETE
- **Purpose:** RESTful API for task management

#### API Endpoints:

**GET:** Retrieve all tasks
```json
Response: {
  "lastId": 10,
  "taskList": [
    {"id": 1, "task": "Call supplier", "task_status": false},
    {"id": 2, "task": "Review bills", "task_status": true}
  ]
}
```

**POST:** Create new task
```json
Request: {"task": "New task description"}
Response: {"status": 200}
```

**PATCH:** Update task (toggle status or edit task)
```json
Request: {
  "id": 1,
  "task_action": "update_status"  // or "update_task"
}
Response: {"status": "success", "new_status": true}
```

**DELETE:** Remove task
```json
Request: {"id": 1}
Response: {"status": "delete success"}
```

---

## 🎨 Frontend Architecture

### Template Structure:
```
templates/accountancy/
├── index.html        # Homepage
├── dashboard.html    # Main dashboard with charts
├── records.html      # Records management
└── test.html         # Ledger view
```

### Static Files:
```
static/accountancy/
├── css/
│   ├── style.css      # Global styles
│   ├── dashboard.css  # Dashboard specific
│   ├── records.css    # Records page
│   └── test.css       # Ledger page
└── JS/
    ├── index.js       # Homepage logic
    ├── dashboard.js   # Dashboard interactions
    ├── graphs.js      # Chart rendering
    ├── records.js     # Records functionality
    └── test.js        # Ledger interactions
```

### UI Components:

**Dashboard Features:**
- KPI Cards (Today's Profit, Collection, Bills, Outstanding)
- Interactive Chart Controls (Daily/Weekly/Monthly toggle)
- Task Management Widget
- Responsive Design

**Records Page Features:**
- Modal Forms (Add Bill, Add Party, Add Payment, View Ledger)
- Image Gallery with Lightbox
- Filter Panel
- Action Buttons

**Ledger Page Features:**
- Dealer Information Card
- Transaction Timeline
- Balance Tracker
- Dealer Selector Dropdown

---

## 🔧 URL Routing Structure

### Main URLs (`jbb_projects/urls.py`):
```python
urlpatterns = [
    path('admin/', admin.site.urls),        # Django Admin
    path('', include('accountancy.urls')),  # Main app routes
]
```

### Accountancy URLs (`accountancy/urls.py`):
```python
urlpatterns = [
    path('', homepage),                                    # Homepage
    path('daily-collection/', daily_collection),           # POST: Record daily money
    path('dashboard/', dashboard),                         # Dashboard view
    path('records/', record_page),                         # Records hub
    path('create-party/', create_party_page),              # POST: Create dealer
    path('bill-uploads/', bill_uploads),                   # POST: Upload bills
    path('payments/', payments),                           # POST: Record payment
    path('ledger-request/', ledger_request),               # POST: Request ledger
    path('ledger-view/<int:requested_dealer>/', ledger),   # View ledger
    path('task-list', task_list),                          # Task API (GET/POST/PATCH/DELETE)
]
```

---

## 📊 System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                          PRESENTATION LAYER                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │   Homepage   │  │  Dashboard   │  │   Records    │              │
│  │  (index.html)│  │(dashboard.html│  │ (records.html)│             │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
│          │                  │                  │                     │
│          └──────────────────┴──────────────────┘                     │
│                             │                                        │
└─────────────────────────────┼────────────────────────────────────────┘
                              │
┌─────────────────────────────┼────────────────────────────────────────┐
│                    APPLICATION LAYER (Django)                        │
│                             │                                        │
│  ┌──────────────────────────▼─────────────────────────────────┐    │
│  │                   URL ROUTING (urls.py)                     │    │
│  │  /, /dashboard/, /records/, /create-party/, /bill-uploads/  │    │
│  │  /payments/, /ledger-view/<id>/, /task-list                │    │
│  └──────────────────────────┬─────────────────────────────────┘    │
│                             │                                        │
│  ┌──────────────────────────▼─────────────────────────────────┐    │
│  │              VIEW LAYER (views.py)                          │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │    │
│  │  │homepage()│  │dashboard()│  │record_   │  │ledger()  │   │    │
│  │  │          │  │          │  │page()    │  │          │   │    │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │    │
│  │                                                             │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │    │
│  │  │daily_    │  │create_   │  │bill_     │  │payments()│   │    │
│  │  │collection│  │party_page│  │uploads() │  │          │   │    │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │    │
│  └─────────────────────────┬───────────────────────────────────┘    │
│                            │                                        │
│  ┌─────────────────────────▼───────────────────────────────────┐    │
│  │           BUSINESS LOGIC & FILTERS (filters.py)             │    │
│  │  - BillFilter (date range, amount, dealer filtering)        │    │
│  │  - Outstanding calculation (Bills - Payments)               │    │
│  │  - Aggregations (TruncWeek, TruncMonth, Sum)                │    │
│  └─────────────────────────┬───────────────────────────────────┘    │
└────────────────────────────┼────────────────────────────────────────┘
                             │
┌────────────────────────────┼────────────────────────────────────────┐
│                    DATA LAYER (models.py)                           │
│                            │                                        │
│  ┌─────────────────────────▼─────────────────────────────────┐    │
│  │                   DJANGO ORM MODELS                         │    │
│  │                                                             │    │
│  │  ┌──────────────────┐      ┌──────────────────┐           │    │
│  │  │ DailyMoneyInputs │      │    Tasklist      │           │    │
│  │  │ - UPI            │      │ - task           │           │    │
│  │  │ - cash           │      │ - task_date      │           │    │
│  │  │ - cards          │      │ - task_status    │           │    │
│  │  │ - date (unique)  │      └──────────────────┘           │    │
│  │  │ - in_total       │                                      │    │
│  │  └──────────────────┘                                      │    │
│  │                                                             │    │
│  │  ┌──────────────────┐                                      │    │
│  │  │    Dealers       │◄──────────┐                          │    │
│  │  │ - party_name     │           │ Foreign Key              │    │
│  │  │ - party_slug     │           │ Relationships            │    │
│  │  │ - GST_num        │           │                          │    │
│  │  │ - opening_balance│           │                          │    │
│  │  └──────────────────┘           │                          │    │
│  │           ▲                     │                          │    │
│  │           │                     │                          │    │
│  │           │                     │                          │    │
│  │  ┌────────┴────────┐   ┌────────┴────────┐               │    │
│  │  │     Bills       │   │    Payments     │               │    │
│  │  │ - bill_img      │   │ - payment_date  │               │    │
│  │  │ - bill_date     │   │ - payment_amount│               │    │
│  │  │ - dealer_id (FK)│   │ - payment_method│               │    │
│  │  │ - bill_amount   │   │ - dealer_id (FK)│               │    │
│  │  └─────────────────┘   └─────────────────┘               │    │
│  └─────────────────────────────────────────────────────────────┘    │
└────────────────────────────┬────────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────────┐
│                    DATABASE LAYER                                   │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │         PostgreSQL Database (AWS RDS)                        │  │
│  │  Host: django-db.crw0iiakch13.ap-south-1.rds.amazonaws.com  │  │
│  │  Port: 5432                                                  │  │
│  │  Database: postgres                                          │  │
│  │                                                              │  │
│  │  Tables:                                                     │  │
│  │  - accountancy_dailymoneyinputs                             │  │
│  │  - accountancy_dealers                                      │  │
│  │  - accountancy_bills                                        │  │
│  │  - accountancy_payments                                     │  │
│  │  - accountancy_tasklist                                     │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                    EXTERNAL SERVICES                                │
│  ┌──────────────────────┐    ┌──────────────────────┐              │
│  │  File Storage        │    │  AWS Elastic         │              │
│  │  - uploads/          │    │  Beanstalk           │              │
│  │  - bill_images/      │    │  (Deployment)        │              │
│  └──────────────────────┘    └──────────────────────┘              │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Data Flow Examples

### Example 1: Adding a Bill
```
1. User clicks "Add Bill" button on Records page
   └─> Opens modal form

2. User fills form:
   - Uploads bill image
   - Selects dealer from dropdown
   - Enters bill amount
   - Selects bill date
   └─> Submits form (POST to /bill-uploads/)

3. Backend (bill_uploads view):
   - Validates file and data
   - Retrieves Dealer object
   - Creates Bills record
   - Saves image to uploads/bill_images/
   └─> Redirects to /records/

4. Records page reloads:
   - Queries Bills with filters
   - Displays new bill in gallery
   - Updates top 3 outstanding (if applicable)
```

### Example 2: Viewing Ledger
```
1. User selects dealer from dropdown on Records page
   └─> Submits form (POST to /ledger-request/)

2. ledger_request view:
   - Extracts dealer ID
   - Redirects to /ledger-view/<dealer_id>/

3. ledger view:
   - Queries all Bills for dealer
   - Queries all Payments for dealer
   - Combines and sorts by date
   - Calculates running balance:
     * Bills increase balance (debit)
     * Payments decrease balance (credit)
   └─> Renders test.html with transaction history

4. Frontend displays:
   - Dealer information
   - Chronological transaction list
   - Current outstanding balance
   - Bill count vs Payment count
```

### Example 3: Dashboard Data Aggregation
```
1. User navigates to /dashboard/

2. dashboard view executes queries:
   ┌─────────────────────────────────────────┐
   │ Query 1: Today's Collection             │
   │ DailyMoneyInputs.filter(date=today)     │
   │ Returns: UPI + cash + cards             │
   └─────────────────────────────────────────┘
   
   ┌─────────────────────────────────────────┐
   │ Query 2: Weekly Trend                   │
   │ DailyMoneyInputs.annotate(              │
   │   week_start=TruncWeek('date')          │
   │ ).aggregate(Sum('in_total'))            │
   │ Returns: [week1_total, week2_total,...] │
   └─────────────────────────────────────────┘
   
   ┌─────────────────────────────────────────┐
   │ Query 3: Monthly Trend                  │
   │ DailyMoneyInputs.annotate(              │
   │   month_start=TruncMonth('date')        │
   │ ).aggregate(Sum('in_total'))            │
   │ Returns: [month1, month2,...]           │
   └─────────────────────────────────────────┘
   
   ┌─────────────────────────────────────────┐
   │ Query 4: Tasks                          │
   │ Tasklist.objects.all().values()         │
   │ Returns: All pending and completed tasks│
   └─────────────────────────────────────────┘

3. Data passed to template context

4. Frontend JavaScript (graphs.js):
   - Receives data as JSON
   - Renders charts using Chart.js or similar
   - Updates KPI cards dynamically
   - Enables chart toggle (Daily/Weekly/Monthly)
```

---

## 📈 Business Logic & Calculations

### 1. **Outstanding Balance Calculation**
```python
# For each dealer:
Total Outstanding = Σ(All Bills) - Σ(All Payments)

# Implementation:
bill_dict = {dealer_id: total_bill_amount}
payment_dict = {dealer_id: total_payment_amount}
ledger_balance = dict(Counter(bill_dict) - Counter(payment_dict))
```

### 2. **Daily Profit Estimation**
```python
# Assumes 20% profit margin on daily collection
today_profit = (todays_collection * 20) / 100
```

### 3. **Weekly Collection Aggregation**
```python
# Groups records by week start date and sums in_total
week_trunc = DailyMoneyInputs.objects.annotate(
    week_start=TruncWeek('date')
).values('week_start').annotate(
    todays_collection=Sum('in_total')
).order_by('week_start')
```

### 4. **Monthly Collection Aggregation**
```python
# Groups records by month start date and sums in_total
month_trunc = DailyMoneyInputs.objects.annotate(
    month_start=TruncMonth('date')
).values('month_start').annotate(
    months_collection=Sum('in_total')
).order_by('month_start')
```

### 5. **Top 3 Dealers by Outstanding**
```python
# Sorts dealers by outstanding amount (descending)
# Takes first 3 entries
top_three_id_amount = dict(itertools.islice(
    ledger_balace.items(), 3
))
```

---

## 🛠️ Key Technologies & Libraries

### Backend Dependencies:
```
Django==5.2.4              # Web framework
djangorestframework==3.16  # REST API support
django-filter==25.1        # Advanced filtering
django-widget-tweaks==1.5  # Form rendering helpers
psycopg2-binary==2.9.10   # PostgreSQL adapter
Pillow==11.3.0            # Image processing
dj-database-url==3.0.1    # Database URL parsing
awsebcli==3.25            # AWS deployment
fabric==3.2.2             # Remote deployment automation
```

### Frontend Technologies:
- **Vanilla JavaScript** (no frameworks detected)
- **CSS3** with custom styling
- **Chart Library** (likely Chart.js based on naming)
- **Responsive Design**

---

## 🗂️ File Upload Configuration

### Image Storage:
```python
# settings.py
MEDIA_ROOT = BASE_DIR / 'uploads'
MEDIA_URL = '/bill_imgs/'
```

### Bill Images:
- **Upload Path:** `uploads/bill_images/`
- **Model Field:** `ImageField(upload_to='bill_images')`
- **Supported Formats:** All Pillow-supported formats (JPG, PNG, GIF, etc.)
- **Access URL:** `/bill_imgs/bill_images/<filename>`

---

## 🔍 Filtering System

### BillFilter (django-filters):
```python
class BillFilter(django_filters.FilterSet):
    amount = NumberFilter(field_name='bill_amount', lookup_expr='gte')
    start_date = DateFilter(field_name='bill_date', lookup_expr='gte')
    end_date = DateFilter(field_name='bill_date', lookup_expr='lte')
    
    class Meta:
        model = Bills
        fields = '__all__'
        exclude = ['bill_img']
```

**Available Filters:**
- **Dealer:** Exact match on dealer_id
- **Amount:** Greater than or equal (>=)
- **Date Range:** Between start_date and end_date
- **Automatic:** All other model fields

**Usage in Template:**
```html
<form method="get">
    {{ filter.form.dealer_id }}
    {{ filter.form.amount }}
    {{ filter.form.start_date }}
    {{ filter.form.end_date }}
    <button type="submit">Search</button>
</form>
```

---

## 🚀 Deployment Configuration

### Database:
- **Type:** PostgreSQL
- **Host:** AWS RDS (django-db.crw0iiakch13.ap-south-1.rds.amazonaws.com)
- **Port:** 5432
- **Database:** postgres
- **User:** JBB

### Static Files:
```python
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATIC_URL = '/static/'
```
- Collected using `python manage.py collectstatic`
- Served from `staticfiles/` directory

### Security Settings:
```python
DEBUG = getenv('IS_DEVELOPMENT', True)  # Should be False in production
ALLOWED_HOSTS = [getenv('APP_HOST', 'localhost')]
SECRET_KEY = 'django-insecure-...'  # ⚠️ Should use environment variable
```

---

## ⚠️ Security Recommendations

### Current Issues:
1. **Hardcoded Database Credentials** in settings.py
2. **SECRET_KEY exposed** in settings.py
3. **No authentication required** for main application views
4. **DEBUG mode** defaults to True
5. **ALLOWED_HOSTS** needs production configuration

### Recommended Fixes:
```python
# Use environment variables
import os
from decouple import config

SECRET_KEY = config('SECRET_KEY')
DEBUG = config('DEBUG', default=False, cast=bool)
ALLOWED_HOSTS = config('ALLOWED_HOSTS', default='').split(',')

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': config('DB_NAME'),
        'USER': config('DB_USER'),
        'PASSWORD': config('DB_PASSWORD'),
        'HOST': config('DB_HOST'),
        'PORT': config('DB_PORT'),
    }
}
```

### Add Authentication:
```python
# In views.py
from django.contrib.auth.decorators import login_required

@login_required
def dashboard(request):
    # existing code

@login_required
def record_page(request):
    # existing code
```

---

## 📊 Database Relationships Diagram

```
┌─────────────────────┐
│      Dealers        │
│  (Party/Supplier)   │
│                     │
│ PK: id              │
│     party_name      │
│     party_slug      │
│     GST_num         │
│     opening_balance │
└──────────┬──────────┘
           │
           │ 1
           │
           │
    ┌──────┴──────┐
    │             │
    │ *           │ *
    │             │
┌───▼────────┐  ┌─▼──────────┐
│   Bills    │  │  Payments  │
│            │  │            │
│ PK: id     │  │ PK: id     │
│    bill_img│  │   payment_ │
│    bill_   │  │   date     │
│    date    │  │   payment_ │
│    bill_   │  │   amount   │
│    amount  │  │   payment_ │
│ FK:dealer_│  │   method   │
│    id      │  │ FK:dealer_ │
│            │  │    id      │
└────────────┘  └────────────┘

┌─────────────────────┐     ┌─────────────────────┐
│ DailyMoneyInputs    │     │     Tasklist        │
│ (Daily Collection)  │     │  (To-Do Tasks)      │
│                     │     │                     │
│ PK: id              │     │ PK: id              │
│     UPI             │     │     task            │
│     cash            │     │     task_date       │
│     cards           │     │     task_status     │
│     date (UNIQUE)   │     │                     │
│     in_total        │     │                     │
└─────────────────────┘     └─────────────────────┘

Legend:
PK = Primary Key
FK = Foreign Key
* = Many (in One-to-Many relationship)
1 = One (in One-to-Many relationship)
```

---

## 🔄 Application Workflow

### 1. **Daily Operations Flow:**
```
Morning:
1. Record opening cash/UPI/cards balance
   └─> /daily-collection/

2. View dashboard for today's status
   └─> /dashboard/

3. Check pending tasks
   └─> Task widget on dashboard

Throughout Day:
4. Bills arrive from dealers
   └─> Upload via /bill-uploads/

5. Make payments to dealers
   └─> Record via /payments/

6. Add new dealers as needed
   └─> Create via /create-party/

End of Day:
7. Review records and outstanding
   └─> /records/ page

8. Check dealer ledgers
   └─> /ledger-view/<dealer_id>/

9. Update task statuses
   └─> Task API /task-list
```

### 2. **Monthly Accounting Flow:**
```
1. Review monthly collection trends
   └─> Dashboard monthly chart

2. Identify top outstanding dealers
   └─> Records page "Top 3 Outstanding"

3. Review individual dealer ledgers
   └─> Ledger view for each dealer

4. Reconcile payments and bills
   └─> Filter bills by date range

5. Calculate profit margins
   └─> Dashboard profit indicators
```

---

## 📱 User Interface Overview

### Dashboard Page:
```
┌─────────────────────────────────────────────────────────┐
│  Dashboard                            [Records Button]   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐         │
│  │📈 Today's  │ │💰 Today's  │ │📋 Bills    │         │
│  │   Profit   │ │ Collection │ │   Today    │         │
│  │  ₹20,000   │ │  ₹100,000  │ │     15     │         │
│  └────────────┘ └────────────┘ └────────────┘         │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Sales Trends       [Daily][Weekly][Monthly]    │   │
│  │                                                  │   │
│  │      📊 Chart Display Area                      │   │
│  │                                                  │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Task List                              [+]     │   │
│  │  ☑ Call supplier ABC                            │   │
│  │  ☐ Review pending bills                         │   │
│  │  ☐ Make payment to XYZ                          │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### Records Page:
```
┌─────────────────────────────────────────────────────────┐
│  Records                           [Dashboard Button]   │
├─────────────────────────────────────────────────────────┤
│  [Add Bill] [Add Party] [Payments] [Ledger]            │
├─────────────────────────────────────────────────────────┤
│  🔍 Search & Filter                                     │
│  Dealer: [Dropdown]  Amount: [>= input]                │
│  Date: [Start] to [End]          [Search Button]       │
├─────────────────────────────────────────────────────────┤
│  📊 Top 3 Outstanding                                   │
│  1. ABC Industries - ₹50,000  (GST: 29XXXXX)           │
│  2. XYZ Traders    - ₹35,000  (GST: 24XXXXX)           │
│  3. PQR Suppliers  - ₹28,000  (GST: 27XXXXX)           │
├─────────────────────────────────────────────────────────┤
│  🖼️ Recent Bills                                        │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                  │
│  │ Bill │ │ Bill │ │ Bill │ │ Bill │                  │
│  │ Image│ │ Image│ │ Image│ │ Image│                  │
│  │ ABC  │ │ XYZ  │ │ PQR  │ │ LMN  │                  │
│  │₹5000 │ │₹8000 │ │₹3500 │ │₹6200 │                  │
│  └──────┘ └──────┘ └──────┘ └──────┘                  │
└─────────────────────────────────────────────────────────┘
```

### Ledger Page:
```
┌─────────────────────────────────────────────────────────┐
│  Ledger: ABC Industries                                 │
├─────────────────────────────────────────────────────────┤
│  Dealer: ABC Industries                                 │
│  GST: 29XXXXX                                           │
│  Current Outstanding: ₹50,000                           │
│  Bills: 25    Payments: 18                              │
├─────────────────────────────────────────────────────────┤
│  Transaction History:                                   │
│  ┌─────────┬──────────┬───────────┬──────────────┐    │
│  │ Date    │ Type     │ Amount    │ Description  │    │
│  ├─────────┼──────────┼───────────┼──────────────┤    │
│  │21/01/26 │ Payment  │ ₹10,000   │ UPI          │    │
│  │20/01/26 │ Bill     │ ₹15,000   │              │    │
│  │19/01/26 │ Bill     │ ₹8,000    │              │    │
│  │18/01/26 │ Payment  │ ₹20,000   │ Cheque       │    │
│  │...      │ ...      │ ...       │ ...          │    │
│  └─────────┴──────────┴───────────┴──────────────┘    │
└─────────────────────────────────────────────────────────┘
```

---

## 🎯 Key Features Summary

### ✅ Implemented:
1. ✅ **Daily Collection Tracking** (UPI/Cash/Cards)
2. ✅ **Dashboard with KPIs** (Profit, Collection, Bills)
3. ✅ **Data Visualization** (Daily/Weekly/Monthly charts)
4. ✅ **Dealer Management** (Add, track, GST info)
5. ✅ **Bill Management** (Upload images, track amounts)
6. ✅ **Payment Recording** (Multiple payment methods)
7. ✅ **Ledger System** (Complete transaction history)
8. ✅ **Outstanding Calculation** (Bills - Payments)
9. ✅ **Advanced Filtering** (Date, amount, dealer)
10. ✅ **Task Management** (To-do list with CRUD API)
11. ✅ **Image Gallery** (Bill image viewer)
12. ✅ **Top Outstanding Dealers** (Top 3 by balance)
13. ✅ **Responsive Design** (Mobile-friendly UI)

### ❌ Missing/Recommended:
1. ❌ **User Authentication** for main app (only admin login exists)
2. ❌ **User Roles & Permissions** (admin, accountant, viewer)
3. ❌ **Email Notifications** (payment reminders, bill alerts)
4. ❌ **PDF Export** (ledgers, reports)
5. ❌ **Backup System** (automated database backups)
6. ❌ **Audit Trail** (track who changed what)
7. ❌ **Multi-branch Support** (if business expands)
8. ❌ **Mobile App** (native iOS/Android)
9. ❌ **WhatsApp Integration** (bill sharing, reminders)
10. ❌ **GST Report Generation** (for tax filing)

---

## 🔧 Development & Deployment

### Local Development:
```bash
# Clone repository
cd /home/ajitesh/Documents/jbb_projects

# Install dependencies
pip install -r requirements.txt

# Apply migrations
python manage.py migrate

# Create superuser (for admin access)
python manage.py createsuperuser

# Collect static files
python manage.py collectstatic

# Run development server
python manage.py runserver

# Access:
# Main app: http://localhost:8000/
# Admin: http://localhost:8000/admin/
```

### Production Deployment (AWS):
```bash
# Initialize Elastic Beanstalk
eb init

# Create environment
eb create jbb-prod-env

# Deploy
eb deploy

# Open in browser
eb open
```

---

## 📝 Project Structure Summary

```
jbb_projects/                    # Project root
├── manage.py                    # Django management script
├── requirements.txt             # Python dependencies
├── db.sqlite3                   # Local SQLite (not used in prod)
│
├── jbb_projects/                # Main project config
│   ├── settings.py              # Django settings
│   ├── urls.py                  # Root URL config
│   ├── wsgi.py                  # WSGI entry point
│   └── asgi.py                  # ASGI entry point
│
├── accountancy/                 # Main application
│   ├── models.py                # Database models (5 models)
│   ├── views.py                 # Business logic (10 views)
│   ├── urls.py                  # App URL routing
│   ├── filters.py               # BillFilter class
│   ├── admin.py                 # Django admin config
│   ├── apps.py                  # App configuration
│   ├── tests.py                 # Test cases
│   │
│   ├── templates/accountancy/   # HTML templates
│   │   ├── index.html           # Homepage
│   │   ├── dashboard.html       # Dashboard
│   │   ├── records.html         # Records management
│   │   └── test.html            # Ledger view
│   │
│   ├── static/accountancy/      # Static assets
│   │   ├── css/                 # Stylesheets
│   │   │   ├── style.css
│   │   │   ├── dashboard.css
│   │   │   ├── records.css
│   │   │   └── test.css
│   │   └── JS/                  # JavaScript files
│   │       ├── index.js
│   │       ├── dashboard.js
│   │       ├── graphs.js
│   │       ├── records.js
│   │       └── test.js
│   │
│   └── migrations/              # Database migrations
│       ├── 0001_initial.py
│       └── __init__.py
│
├── uploads/                     # Media files
│   └── bill_images/             # Uploaded bill images
│
└── staticfiles/                 # Collected static files
    ├── accountancy/             # App static files (copied)
    └── admin/                   # Django admin static files
```

---

## 🎓 Learning & Understanding

### For Developers:
This project demonstrates:
1. **Django MVT Pattern** (Model-View-Template)
2. **ORM Relationships** (ForeignKey, CASCADE deletion)
3. **Image Uploads** (Pillow, ImageField)
4. **RESTful API Design** (GET/POST/PATCH/DELETE)
5. **Database Aggregations** (Sum, TruncWeek, TruncMonth)
6. **Filtering Systems** (django-filter)
7. **Form Handling** (POST requests, validation)
8. **Static File Management** (collectstatic)
9. **PostgreSQL Integration** (AWS RDS)
10. **AWS Deployment** (Elastic Beanstalk)

### For Business Users:
This system helps you:
1. **Track Daily Revenue** across payment methods
2. **Manage Supplier Relationships** with GST tracking
3. **Monitor Outstanding Balances** in real-time
4. **Visualize Business Trends** with charts
5. **Maintain Transaction History** for auditing
6. **Filter and Search Records** quickly
7. **Organize Daily Tasks** efficiently
8. **Access from Anywhere** (cloud-hosted)

---

## 📞 Support & Maintenance

### Common Tasks:

**Add a new dealer:**
1. Navigate to /records/
2. Click "Add Party"
3. Fill form (name, GST, opening balance)
4. Submit

**Upload a bill:**
1. Navigate to /records/
2. Click "Add Bill"
3. Select dealer, upload image, enter amount
4. Submit

**Make a payment:**
1. Navigate to /records/
2. Click "Payments"
3. Select dealer, enter amount, date, method
4. Submit

**View ledger:**
1. Navigate to /records/
2. Click "Ledger"
3. Select dealer from dropdown
4. Submit

**Track daily collection:**
1. Navigate to /dashboard/
2. Scroll to daily collection form
3. Enter UPI/Cash/Card amounts
4. Submit

---

## 🏁 Conclusion

**JBB Projects** is a fully functional business accounting system that streamlines financial operations for small to medium businesses. It combines data visualization, record management, and transaction tracking into a unified platform.

### Strengths:
- ✅ Clean, intuitive UI
- ✅ Comprehensive ledger system
- ✅ Real-time outstanding calculation
- ✅ Visual data representation
- ✅ Scalable PostgreSQL backend
- ✅ Cloud-ready deployment

### Areas for Improvement:
- 🔧 Add user authentication for main app
- 🔧 Implement role-based access control
- 🔧 Move credentials to environment variables
- 🔧 Add PDF export functionality
- 🔧 Implement email notifications
- 🔧 Add audit logging

---

**Version:** 1.0  
**Last Updated:** January 21, 2026  
**Technology:** Django 5.2.4 + PostgreSQL  
**Status:** Production Ready (with security enhancements recommended)

---

