import http from 'http';

const req = http.get('http://localhost:5000/api/admin/delivery-partners/earnings?page=1&limit=50', (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      console.log(`Earnings count: ${json.data.earnings.length}`);
      console.log(`Total summary count: ${json.data.summary.totalOrders}`);
      console.log(`Pagination: ${JSON.stringify(json.data.pagination)}`);
      // check unique transactionIds
      const txns = json.data.earnings.map(e => e.transactionId);
      const uniqueTxns = new Set(txns);
      console.log(`Unique transactionIds: ${uniqueTxns.size} out of ${txns.length}`);
      
    } catch (e) {
      console.log(e.message);
    }
  });
});
req.on('error', (e) => {
  console.error(e);
});
