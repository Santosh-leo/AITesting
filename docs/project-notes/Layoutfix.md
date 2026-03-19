# 🎯 Frontend Layout Refactor – TARS Application

## Objective
Refactor the frontend layout to improve user experience **without changing any functionality, logic, or APIs**.

---

## ⚠️ General Constraints
- Do **not** modify backend logic or API contracts.
- Do **not** change business behavior or workflows.
- Focus strictly on **UI/UX improvements (layout, positioning, rendering)**.
- Maintain responsiveness and consistency with the existing design system.

---

## 🧪 Test Builder Page

### Current Issue
- Input Specifications and Generated Tests are separated into tabs.

### Required Changes
- Replace tab-based layout with a **split-screen (side-by-side) layout**.

### Layout
- **Left Panel**
  - Input field for User Story / Acceptance Criteria.
- **Right Panel**
  - Display Generated Test Cases.

### Behavior
- When the user enters input and triggers generation:
  - Results should appear **in parallel on the right side**.
  - No navigation or tab switching.

### Additional Requirements
- Independent scrolling for both panels.
- Responsive fallback:
  - Stack panels vertically on smaller screens.

---

## ⚙️ Auto Test Page

### Required Changes
- Apply the **same split-screen layout pattern** as Test Builder.

### Layout
- **Left Panel** → Input / Configuration
- **Right Panel** → Generated Tests Output

### Notes
- No changes to functionality or workflows.

---

## 🎥 Recorder Page

### Current Issue
- Browser launches separately from the main UI.

### Required Changes

#### Launch Behavior
- On clicking **"Launch Browser"**:
  - Open the browser **embedded within the same page** (e.g., iframe or container view).

#### Recording State
- User interacts directly within the embedded browser.

#### Post-Recording
- On clicking **"Stop Recording"**:
  - Display generated test cases **below the browser container**.

### Layout
- **Top Section** → Embedded Browser
- **Bottom Section** → Generated Test Cases

---

## 🏠 Home Page

### Current Issue
- Static images used for feature previews.

### Required Changes
- Replace images with **short looping videos (~3 seconds)** demonstrating each feature.

### Video Requirements
- Auto-play enabled
- Muted by default
- Loop continuously
- Optimized for performance (small file size)

---

## 🎨 UX Expectations
- Clean and modern layout
- Clear visual hierarchy
- Minimize page navigation
- Smooth transitions
- Consistent design across pages

---

## ✅ Deliverables
- Updated frontend components for:
  - Test Builder Page
  - Auto Test Page
  - Recorder Page
  - Home Page
- No regression in existing functionality
- Fully responsive across screen sizes