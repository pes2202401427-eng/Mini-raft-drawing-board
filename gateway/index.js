const express = require('express');
const app = express();

const PORT = 8080;

app.get('/', (req, res) => {
  res.send('Gateway is running');
});

app.listen(PORT, () => {
  console.log(`Gateway running on port ${PORT}`);
});