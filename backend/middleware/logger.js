export const requestLogger = (req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
};

export const databaseLogger = (database, operation) => {
  console.log(`📊 ${database} - ${operation}`);
};