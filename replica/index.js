const express = require('express');
const app = express();

const PORT = process.env.PORT || 5000;

app.get('/', (req, res) => {
  res.send(`Replica ${process.env.REPLICA_ID} is running`);
});

app.listen(PORT, () => {
  console.log(`Replica ${process.env.REPLICA_ID} running on port ${PORT}`);
});