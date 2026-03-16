import dotenv from 'dotenv';

dotenv.config();

export const config = {
  PORT: process.env.PORT || 3006,
  HOST: process.env.HOST || "0.0.0.0",
  NODE_ENV: process.env.NODE_ENV || 'development'
};