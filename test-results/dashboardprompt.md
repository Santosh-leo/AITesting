## Role

You are a senior full-stack engineer responsible for improving the frontend and data visualization of the application.

## Objective

Add a **Dashboard section** to the frontend sidebar that displays **historical results from the Auto Test page**. The dashboard should store results from each Auto Test run and present them using graphical visualizations.

## Context

The application already has:

* A **Frontend UI with a sidebar navigation**
* An **Auto Test page** that executes automated tests and produces results

Currently:

* Test results are shown only after execution
* Results are **not stored for historical analysis**
* No dashboard or analytics visualization exists

## Requirements

### 1. Sidebar Navigation

* Add a new menu item called **"Dashboard"** to the sidebar.
* Ensure it follows the same design pattern as other sidebar items.
* Clicking **Dashboard** should navigate to a new dashboard page.

### 2. Test Result Storage

* Capture the results of every Auto Test execution.

* Store the following information for each run:

  * Test run ID
  * Timestamp
  * Total tests executed
  * Passed tests
  * Failed tests
  * Execution duration
  * Status summary

* Persist results in a **database or persistent storage** so historical runs are available.

### 3. Dashboard Page

Create a dashboard page that includes:

#### Summary Metrics

* Total number of test runs
* Pass rate
* Fail rate
* Latest test run status

#### Graphical Visualization

Display results using charts such as:

* **Line chart**

  * Test success rate over time

* **Bar chart**

  * Passed vs failed tests per run

* **Pie chart**

  * Overall pass vs fail distribution

### 4. Data Flow

* Auto Test execution → store results
* Dashboard → fetch stored results
* Charts → render aggregated data

### 5. UI/UX Guidelines

* Maintain consistency with existing UI design
* Charts should be clean and responsive
* Provide loading states when fetching results
* Handle cases where no test data exists

### 6. Performance

* Dashboard queries should be optimized for multiple test runs
* Avoid blocking UI when fetching large datasets

## Deliverables

Provide the following:

1. Frontend changes

   * Sidebar modification
   * Dashboard page implementation
   * Chart components

2. Backend or data-layer logic

   * API endpoint to store Auto Test results
   * API endpoint to retrieve dashboard analytics

3. Example data structure for stored test results.

4. Recommended chart library (e.g., Chart.js, Recharts, or similar).

## Expected Outcome

Users should be able to:

* Run automated tests
* Have each test run stored automatically
* Open the **Dashboard** from the sidebar
* View **historical test performance and graphical analytics**
