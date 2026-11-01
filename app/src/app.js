'use strict';
// ShopEase - a small e-commerce storefront + REST API used for the PBL-III DevOps practicals.
const express = require('express');
const os = require('os');

const VERSION = process.env.APP_VERSION || 'dev';
const COLOR = (process.env.DEPLOY_COLOR || 'none').toLowerCase();

const products = [
  { id: 1, name: 'Wireless Earbuds', price: 1999, category: 'Electronics', stock: 42 },
  { id: 2, name: 'Smart Watch', price: 4499, category: 'Electronics', stock: 18 },
  { id: 3, name: 'Running Shoes', price: 2799, category: 'Fashion', stock: 30 },
  { id: 4, name: 'Cotton T-Shirt', price: 599, category: 'Fashion', stock: 120 },
  { id: 5, name: 'Steel Water Bottle', price: 449, category: 'Home', stock: 75 },
  { id: 6, name: 'Desk Lamp (LED)', price: 1299, category: 'Home', stock: 25 }
];

const carts = new Map(); // cartId -> [{productId, qty}]

function cartFor(req) {
  const id = String(req.get('x-cart-id') || 'guest').slice(0, 40);
  if (!carts.has(id)) carts.set(id, []);
  return carts.get(id);
}

function cartSummary(items) {
  const lines = items.map((i) => {
    const p = products.find((x) => x.id === i.productId);
    return { productId: i.productId, name: p.name, qty: i.qty, lineTotal: p.price * i.qty };
  });
  return { items: lines, total: lines.reduce((s, l) => s + l.lineTotal, 0) };
}

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '10kb' }));

app.get('/health', (req, res) => res.json({ status: 'UP' }));
app.get('/version', (req, res) => res.json({ app: 'shopease', version: VERSION, color: COLOR, pod: os.hostname() }));

app.get('/api/products', (req, res) => {
  const { category } = req.query;
  res.json(category ? products.filter((p) => p.category.toLowerCase() === String(category).toLowerCase()) : products);
});

app.get('/api/products/:id', (req, res) => {
  const p = products.find((x) => x.id === Number(req.params.id));
  if (!p) return res.status(404).json({ error: 'Product not found' });
  res.json(p);
});

app.get('/api/cart', (req, res) => res.json(cartSummary(cartFor(req))));

app.post('/api/cart', (req, res) => {
  const productId = Number(req.body && req.body.productId);
  const qty = Number((req.body && req.body.qty) || 1);
  const p = products.find((x) => x.id === productId);
  if (!p) return res.status(400).json({ error: 'Invalid productId' });
  if (!Number.isInteger(qty) || qty < 1 || qty > 10) return res.status(400).json({ error: 'qty must be 1-10' });
  const cart = cartFor(req);
  const line = cart.find((i) => i.productId === productId);
  if (line) line.qty = Math.min(10, line.qty + qty);
  else cart.push({ productId, qty });
  res.status(201).json(cartSummary(cart));
});

app.delete('/api/cart', (req, res) => {
  cartFor(req).length = 0;
  res.json(cartSummary([]));
});

const THEME = { blue: '#1d4ed8', green: '#15803d', none: '#4338ca' };

app.get('/', (req, res) => {
  const bar = THEME[COLOR] || THEME.none;
  const label = COLOR === 'none' ? '' : `<span class="pill">${COLOR.toUpperCase()} environment</span>`;
  res.type('html').send(`<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>ShopEase</title>
<style>
body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f4f5f7;color:#111}
header{background:${bar};color:#fff;padding:18px 24px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
header h1{margin:0;font-size:24px}.pill{background:rgba(255,255,255,.2);padding:4px 10px;border-radius:999px;font-size:13px;font-weight:600}
main{max-width:980px;margin:24px auto;padding:0 16px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px}
.card{background:#fff;border-radius:10px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,.08)}.card h3{margin:0 0 6px;font-size:17px}
.price{font-weight:700;font-size:18px;margin:8px 0}.cat{color:#666;font-size:13px}
button{background:${bar};color:#fff;border:0;border-radius:6px;padding:8px 12px;cursor:pointer;font-weight:600}
  .offer{background:#fef3c7;border:1px solid #fcd34d;color:#92400e;border-radius:8px;padding:10px 14px;margin-bottom:16px;font-weight:600}
footer{max-width:980px;margin:24px auto;padding:0 16px 32px;color:#555;font-size:13px}
</style></head><body>
<header><h1>🛒 ShopEase</h1><div>${label} <span class="pill">${VERSION}</span> <span class="pill" id="cart">Cart: 0 items</span></div></header>
<main><div class="offer">🚚 Free delivery on orders above ₹999 · Festive offers live now</div><div class="grid" id="grid"></div></main>
<footer>Served by pod <b>${os.hostname()}</b> · version <b>${VERSION}</b> · deployed via Jenkins → Docker → Kubernetes</footer>
<script>
const H={'Content-Type':'application/json','x-cart-id':'web'};
function inr(n){return '₹'+n.toLocaleString('en-IN')}
async function refresh(){const c=await (await fetch('/api/cart',{headers:H})).json();document.getElementById('cart').textContent='Cart: '+c.items.reduce((s,i)=>s+i.qty,0)+' items ('+inr(c.total)+')'}
async function add(id){await fetch('/api/cart',{method:'POST',headers:H,body:JSON.stringify({productId:id,qty:1})});refresh()}
fetch('/api/products').then(r=>r.json()).then(ps=>{document.getElementById('grid').innerHTML=ps.map(p=>'<div class="card"><h3>'+p.name+'</h3><div class="cat">'+p.category+' · '+p.stock+' in stock</div><div class="price">'+inr(p.price)+'</div><button onclick="add('+p.id+')">Add to cart</button></div>').join('');refresh()});
</script></body></html>`);
});

module.exports = app;
