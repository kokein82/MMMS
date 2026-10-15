/* MMMS Seed Data Generator — run: node seed.js */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const now = () => new Date().toISOString();
const today = () => new Date().toISOString().slice(0, 10);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

const data = {
  users: [
    {
      id: uid(), name: 'Admin', username: 'admin', role: 'admin',
      password: crypto.createHash('sha256').update('Admin@123').digest('base64'),
      createdAt: daysAgo(30)
    },
    {
      id: uid(), name: 'Jean Baptiste', username: 'headteacher', role: 'head_teacher',
      password: crypto.createHash('sha256').update('Teacher@123').digest('base64'),
      createdAt: daysAgo(30)
    },
    {
      id: uid(), name: 'Alice Mukamana', username: 'welfare', role: 'welfare_prefect',
      password: crypto.createHash('sha256').update('Welfare@123').digest('base64'),
      createdAt: daysAgo(28)
    }
  ],

  consumables: [
    { id: uid(), name: 'A4 Paper', code: 'ST-001', category: 'Stationery', qty: 85, min: 20, unitCost: 12000, location: 'Store Rack A', notes: 'Boxes of 500 sheets', createdAt: daysAgo(60), updatedAt: daysAgo(2) },
    { id: uid(), name: 'Blue Pens', code: 'ST-002', category: 'Stationery', qty: 240, min: 50, unitCost: 500, location: 'Store Rack A', notes: 'Box of 12', createdAt: daysAgo(60), updatedAt: daysAgo(5) },
    { id: uid(), name: 'Whiteboard Markers', code: 'ST-003', category: 'Stationery', qty: 30, min: 15, unitCost: 1500, location: 'Store Rack A', notes: 'Assorted colours', createdAt: daysAgo(45), updatedAt: daysAgo(3) },
    { id: uid(), name: 'Brooms', code: 'CL-001', category: 'Cleaning', qty: 25, min: 10, unitCost: 2000, location: 'Store Rack B', notes: 'Local handmade', createdAt: daysAgo(90), updatedAt: daysAgo(10) },
    { id: uid(), name: 'Detergent (Liquid)', code: 'CL-002', category: 'Cleaning', qty: 45, min: 10, unitCost: 8500, location: 'Store Rack B', notes: '20L jerrycans', createdAt: daysAgo(30), updatedAt: daysAgo(1) },
    { id: uid(), name: 'Chalk (White)', code: 'ST-004', category: 'Stationery', qty: 12, min: 20, unitCost: 3000, location: 'Store Rack A', notes: 'Boxes of 100', createdAt: daysAgo(20), updatedAt: daysAgo(7) },
    { id: uid(), name: 'Glue Sticks', code: 'ST-005', category: 'Stationery', qty: 60, min: 15, unitCost: 800, location: 'Store Rack A', notes: '', createdAt: daysAgo(50), updatedAt: daysAgo(15) },
    { id: uid(), name: 'Light Bulbs (LED)', code: 'EL-001', category: 'Electrical', qty: 18, min: 10, unitCost: 3500, location: 'Store Rack C', notes: '9W LED', createdAt: daysAgo(40), updatedAt: daysAgo(8) },
    { id: uid(), name: 'Batteries (AA)', code: 'EL-002', category: 'Electrical', qty: 48, min: 20, unitCost: 1500, location: 'Store Rack C', notes: 'Pack of 4', createdAt: daysAgo(35), updatedAt: daysAgo(6) },
    { id: uid(), name: 'Exercise Books', code: 'ST-006', category: 'Stationery', qty: 320, min: 100, unitCost: 1200, location: 'Store Rack A', notes: '200-page counter books', createdAt: daysAgo(25), updatedAt: daysAgo(4) }
  ],

  borrows: [
    { id: uid(), itemId: null, itemName: 'Projector', person: 'Mr. Habimana', dept: 'Science Dept', qty: 1, purpose: 'Science week presentation', expectedReturn: daysAgo(-3), condition: 'Good', notes: '', borrowedAt: daysAgo(5), returnedAt: null, status: 'active' },
    { id: uid(), itemId: null, itemName: 'Camera', person: 'Ms. Uwimana', dept: 'Media Club', qty: 1, purpose: 'Sports day coverage', expectedReturn: daysAgo(-1), condition: 'Good', notes: '', borrowedAt: daysAgo(3), returnedAt: null, status: 'active' }
  ],

  foodItems: [
    { id: uid(), name: 'Maize Flour', category: 'Staples', qty: 500, unit: 'kg', min: 100, unitCost: 1200, expiryDate: daysAgo(-60), location: 'Granary A', supplier: '', code: 'GR-001', notes: 'Grade 1 fortified', createdAt: daysAgo(15), updatedAt: daysAgo(1) },
    { id: uid(), name: 'Beans', category: 'Legumes', qty: 200, unit: 'kg', min: 50, unitCost: 1800, expiryDate: daysAgo(-90), location: 'Granary A', supplier: '', code: 'GR-002', notes: 'Red beans', createdAt: daysAgo(20), updatedAt: daysAgo(2) },
    { id: uid(), name: 'Rice', category: 'Staples', qty: 150, unit: 'kg', min: 40, unitCost: 2200, expiryDate: daysAgo(-120), location: 'Granary A', supplier: '', code: 'GR-003', notes: 'Premium long grain', createdAt: daysAgo(25), updatedAt: daysAgo(3) },
    { id: uid(), name: 'Cooking Oil', category: 'Cooking Essentials', qty: 80, unit: 'L', min: 20, unitCost: 4500, expiryDate: daysAgo(-180), location: 'Granary B', supplier: '', code: 'GR-004', notes: 'Fortified vegetable oil', createdAt: daysAgo(30), updatedAt: daysAgo(1) },
    { id: uid(), name: 'Sugar', category: 'Cooking Essentials', qty: 60, unit: 'kg', min: 15, unitCost: 2800, expiryDate: daysAgo(-365), location: 'Granary B', supplier: '', code: 'GR-005', notes: 'White sugar', createdAt: daysAgo(10), updatedAt: daysAgo(5) },
    { id: uid(), name: 'Salt', category: 'Cooking Essentials', qty: 30, unit: 'kg', min: 10, unitCost: 500, expiryDate: '', location: 'Granary B', supplier: '', code: 'GR-006', notes: 'Iodized salt', createdAt: daysAgo(40), updatedAt: daysAgo(10) },
    { id: uid(), name: 'Fresh Milk', category: 'Dairy', qty: 50, unit: 'L', min: 20, unitCost: 1500, expiryDate: daysAgo(-7), location: 'Cold Room', supplier: '', code: 'DA-001', notes: 'From school farm', createdAt: daysAgo(2), updatedAt: daysAgo(1) },
    { id: uid(), name: 'Irish Potatoes', category: 'Vegetables', qty: 180, unit: 'kg', min: 30, unitCost: 900, expiryDate: daysAgo(-14), location: 'Granary A', supplier: '', code: 'VG-001', notes: 'Fresh harvest', createdAt: daysAgo(5), updatedAt: daysAgo(2) }
  ],

  deliveries: [
    { id: uid(), deliveryNo: 'DEL-001', foodId: null, foodName: 'Maize Flour', qty: 500, supplier: 'Rwanda Food Distributors Ltd', receivedBy: 'Admin', date: daysAgo(15), notes: 'Monthly supply', unitCost: 1150, totalCost: 575000, createdAt: daysAgo(15) },
    { id: uid(), deliveryNo: 'DEL-002', foodId: null, foodName: 'Cooking Oil', qty: 80, supplier: 'Rwanda Food Distributors Ltd', receivedBy: 'Admin', date: daysAgo(10), notes: '', unitCost: 4300, totalCost: 344000, createdAt: daysAgo(10) },
    { id: uid(), deliveryNo: 'DEL-003', foodId: null, foodName: 'Beans', qty: 200, supplier: 'Huye Farmers Cooperative', receivedBy: 'Jean Baptiste', date: daysAgo(7), notes: 'New harvest', unitCost: 1700, totalCost: 340000, createdAt: daysAgo(7) }
  ],

  issues: [
    { id: uid(), deliveryNo: 'ISS-001', foodId: null, foodName: 'Maize Flour', qty: 80, dept: 'Kitchen', issuedTo: 'Head Cook', date: daysAgo(3), notes: 'Weekly allocation', createdAt: daysAgo(3) },
    { id: uid(), deliveryNo: 'ISS-002', foodId: null, foodName: 'Beans', qty: 30, dept: 'Kitchen', issuedTo: 'Head Cook', date: daysAgo(3), notes: '', createdAt: daysAgo(3) },
    { id: uid(), deliveryNo: 'ISS-003', foodId: null, foodName: 'Cooking Oil', qty: 10, dept: 'Kitchen', issuedTo: 'Head Cook', date: daysAgo(2), notes: '', createdAt: daysAgo(2) },
    { id: uid(), deliveryNo: 'ISS-004', foodId: null, foodName: 'Rice', qty: 20, dept: 'Kitchen', issuedTo: 'Head Cook', date: daysAgo(1), notes: 'Special lunch', createdAt: daysAgo(1) }
  ],

  consumption: [
    { id: uid(), foodId: null, foodName: 'Maize Flour', qty: 75, meal: 'Breakfast', date: today(), notes: '', createdAt: now() },
    { id: uid(), foodId: null, foodName: 'Beans', qty: 25, meal: 'Lunch', date: today(), notes: '', createdAt: now() },
    { id: uid(), foodId: null, foodName: 'Cooking Oil', qty: 5, meal: 'Lunch', date: today(), notes: '', createdAt: now() },
    { id: uid(), foodId: null, foodName: 'Maize Flour', qty: 70, meal: 'Dinner', date: daysAgo(1), notes: '', createdAt: daysAgo(1) },
    { id: uid(), foodId: null, foodName: 'Rice', qty: 18, meal: 'Lunch', date: daysAgo(1), notes: '', createdAt: daysAgo(1) },
    { id: uid(), foodId: null, foodName: 'Irish Potatoes', qty: 40, meal: 'Dinner', date: daysAgo(2), notes: '', createdAt: daysAgo(2) },
    { id: uid(), foodId: null, foodName: 'Beans', qty: 20, meal: 'Lunch', date: daysAgo(2), notes: '', createdAt: daysAgo(2) }
  ],

  equipment: [
    { id: uid(), name: 'Dinner Plates', category: 'Plates', qty: 200, min: 50, condition: 'Good', status: 'Available', unitCost: 2500, location: 'Main Rack A1', purchaseDate: daysAgo(-365), lifespan: 5, notes: 'White ceramic', createdAt: daysAgo(-365), updatedAt: daysAgo(30) },
    { id: uid(), name: 'Soup Bowls', category: 'Bowls', qty: 120, min: 30, condition: 'Good', status: 'Available', unitCost: 2000, location: 'Main Rack A2', purchaseDate: daysAgo(-365), lifespan: 4, notes: '', createdAt: daysAgo(-365), updatedAt: daysAgo(30) },
    { id: uid(), name: 'Serving Trays', category: 'Serving', qty: 40, min: 10, condition: 'Good', status: 'Available', unitCost: 5000, location: 'Main Rack B1', purchaseDate: daysAgo(-180), lifespan: 3, notes: 'Stainless steel', createdAt: daysAgo(-180), updatedAt: daysAgo(20) },
    { id: uid(), name: 'Cooking Pots (Large)', category: 'Cookware', qty: 8, min: 4, condition: 'Good', status: 'Available', unitCost: 35000, location: 'Kitchen Store', purchaseDate: daysAgo(-730), lifespan: 10, notes: 'Aluminium, 100L', createdAt: daysAgo(-730), updatedAt: daysAgo(15) },
    { id: uid(), name: 'Water Dispensers', category: 'Serving', qty: 6, min: 3, condition: 'Fair', status: 'Available', unitCost: 45000, location: 'Dining Hall', purchaseDate: daysAgo(-180), lifespan: 3, notes: 'Electric coolers', createdAt: daysAgo(-180), updatedAt: daysAgo(5) }
  ],

  damages: [
    { id: uid(), itemName: 'Dinner Plates', category: 'Plates', qty: 12, type: 'Broken', date: daysAgo(5), reportedBy: 'Admin', notes: 'Accidental breakage during cleaning', status: 'Resolved', createdAt: daysAgo(5) },
    { id: uid(), itemName: 'Soup Bowls', category: 'Bowls', qty: 5, type: 'Broken', date: daysAgo(3), reportedBy: 'Head Cook', notes: 'Cracked during use', status: 'Pending', createdAt: daysAgo(3) }
  ],

  suppliers: [
    { id: uid(), name: 'Rwanda Food Distributors Ltd', contactPerson: 'Jean Pierre', phone: '0788123456', email: 'info@rwfood.rw', products: 'Cereals, Legumes, Cooking Oil', address: 'Kigali, Rwanda', notes: 'National supplier', createdAt: daysAgo(-365), updatedAt: daysAgo(10) },
    { id: uid(), name: 'Huye Farmers Cooperative', contactPerson: 'Patrick Habimana', phone: '0788345678', email: 'sales@huyefarm.rw', products: 'Vegetables, Fruits, Dairy', address: 'Huye, Rwanda', notes: 'Local cooperative', createdAt: daysAgo(-180), updatedAt: daysAgo(15) }
  ],

  activities: [
    { id: uid(), timestamp: daysAgo(30), userId: 'system', userName: 'System', action: 'System initialized', category: 'system', details: 'MMMS first launch' },
    { id: uid(), timestamp: daysAgo(28), userId: 'admin', userName: 'Admin', action: 'Login', category: 'auth', details: 'Admin logged in' },
    { id: uid(), timestamp: daysAgo(15), userId: 'admin', userName: 'Admin', action: 'Added food item: Maize Flour', category: 'food', details: 'New food item created' },
    { id: uid(), timestamp: daysAgo(10), userId: 'admin', userName: 'Admin', action: 'Food delivery received: Cooking Oil x80', category: 'food', details: 'Delivery #DEL-002' },
    { id: uid(), timestamp: daysAgo(5), userId: 'admin', userName: 'Admin', action: 'Added welfare record: Marie Claire (Sick Bay)', category: 'welfare', details: 'New record' },
    { id: uid(), timestamp: daysAgo(3), userId: 'admin', userName: 'Admin', action: 'Login', category: 'auth', details: 'Admin logged in' },
    { id: uid(), timestamp: today(), userId: 'admin', userName: 'Admin', action: 'Created breakfast plan', category: 'food', details: 'Breakfast plan updated' }
  ],

  auditTrail: [
    { id: uid(), timestamp: daysAgo(30), userId: 'admin', userName: 'Admin', userRole: 'admin', action: 'System initialized', itemType: 'system', itemId: null, details: 'MMMS first launch' }
  ],

  notifications: [
    { id: uid(), timestamp: daysAgo(1), type: 'warning', title: 'Overdue Return', message: 'Mr. Habimana was expected to return Projector', read: false },
    { id: uid(), timestamp: daysAgo(5), type: 'info', title: 'Item Borrowed', message: 'Ms. Uwimana borrowed Camera', read: false },
    { id: uid(), timestamp: daysAgo(3), type: 'info', title: 'Food Received', message: 'Beans x200 received', read: true }
  ],

  breakfastSettings: {
    breadPrice: 600, cakePrice: 400, breadUnit: 'Loaf', cakeUnit: 'Piece',
    breadSource: 'Mubiligi Bakery', cakeSource: 'School Kitchen',
    stockDate: daysAgo(1), breadsReceived: 400, cakesReceived: 120,
    breadsConsumed: 380, cakesConsumed: 95, breadCost: 240000, cakeCost: 48000
  },

  breakfastPlans: [
    { id: uid(), date: daysAgo(1), breadAllocation: 'boarding', breadCount: 380, cakeCount: 100, breadsReceived: 400, cakesReceived: 120, breadCost: 600, cakeCost: 400, notes: 'Regular day', createdAt: daysAgo(1) },
    { id: uid(), date: today(), breadAllocation: 'boarding', breadCount: 370, cakeCount: 95, breadsReceived: 380, cakesReceived: 110, breadCost: 600, cakeCost: 400, notes: 'Some students on leave', createdAt: today() }
  ],

  agasekeProducts: {
    fermented_milk: { name: 'Fermented Milk', defaultQty: 1, unit: 'Litre' },
    eggs: { name: 'Eggs', defaultQty: 1, unit: 'Piece' },
    yellow_bananas: { name: 'Yellow Bananas', defaultQty: 2, unit: 'Piece' }
  },

  agasekeRecords: [
    { id: uid(), date: daysAgo(3), studentsPresent: 450, qtyPerStudent: 1, stockReceived: 500, stockDistributed: 450, products: { fermented_milk: { dispensed: 450, remaining: 50 }, eggs: { dispensed: 450, remaining: 50 }, yellow_bananas: { dispensed: 900, remaining: 100 } }, notes: 'All students present', createdAt: daysAgo(3) },
    { id: uid(), date: daysAgo(1), studentsPresent: 420, qtyPerStudent: 1, stockReceived: 450, stockDistributed: 420, products: { fermented_milk: { dispensed: 420, remaining: 30 }, eggs: { dispensed: 420, remaining: 30 }, yellow_bananas: { dispensed: 840, remaining: 60 } }, notes: 'Some absent', createdAt: daysAgo(1) }
  ],

  welfareRecords: [
    { id: uid(), studentName: 'Marie Claire', studentId: 'STU-0234', class: 'S4A', dormitory: 'St. Mary', date: daysAgo(5), status: 'Sick Bay', expectedReturn: daysAgo(-2), reason: 'Malaria', notes: 'On medication', createdAt: daysAgo(5) },
    { id: uid(), studentName: 'Jean Paul', studentId: 'STU-0456', class: 'S3B', dormitory: 'St. Joseph', date: daysAgo(3), status: 'Sent Home', expectedReturn: daysAgo(7), reason: 'Family emergency', notes: 'Father contacted', createdAt: daysAgo(3) },
    { id: uid(), studentName: 'Alice Uwimana', studentId: 'STU-0789', class: 'S5A', dormitory: 'St. Claire', date: daysAgo(10), status: 'Returned to School', expectedReturn: daysAgo(-5), reason: 'Medical appointment', notes: 'Returned with doctors note', createdAt: daysAgo(10), returnedAt: daysAgo(-5) },
    { id: uid(), studentName: 'David Habineza', studentId: 'STU-0123', class: 'S2A', dormitory: 'St. John', date: daysAgo(1), status: 'Sick in Dormitory', expectedReturn: '', reason: 'Flu symptoms', notes: 'School nurse attending', createdAt: daysAgo(1) },
    { id: uid(), studentName: 'Grace Mukamana', studentId: 'STU-0567', class: 'S6B', dormitory: 'St. Anne', date: daysAgo(7), status: 'Hospitalized', expectedReturn: daysAgo(3), reason: 'Severe headache', notes: 'Referred to district hospital', createdAt: daysAgo(7) }
  ],

  theme: 'light'
};

// Write to data.json
const dir = path.join(__dirname, 'data');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'data.json'), JSON.stringify(data, null, 2), 'utf-8');
console.log('✅ Seed data written to data/data.json');
console.log('   Users: ' + data.users.length);
console.log('   Consumables: ' + data.consumables.length);
console.log('   Food Items: ' + data.foodItems.length);
console.log('   Equipment: ' + data.equipment.length);
console.log('   Welfare Records: ' + data.welfareRecords.length);
console.log('   Breakfast Plans: ' + data.breakfastPlans.length);
console.log('   Agaseke Records: ' + data.agasekeRecords.length);
