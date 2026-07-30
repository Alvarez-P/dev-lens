/**
 * Application configuration schema.
 * Defines the shape of validated configuration values.
 */
export interface DatabaseConfig {
  url: string;
}

export interface RedisConfig {
  url: string;
}

export interface MinioConfig {
  endpoint: string;
  port: number;
  accessKey: string;
  secretKey: string;
  bucket: string;
}

export interface AuthConfig {
  jwtSecret: string;
}

export interface AppConfiguration {
  nodeEnv: string;
  port: number;
  database: DatabaseConfig;
  redis: RedisConfig;
  minio: MinioConfig;
  auth: AuthConfig;
  logLevel: string;
}

export default (): AppConfiguration => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3001', 10),
  database: {
    url: process.env.DATABASE_URL || 'postgresql://devlens:devlens@localhost:5432/devlens',
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  minio: {
    endpoint: process.env.MINIO_ENDPOINT || 'localhost',
    port: parseInt(process.env.MINIO_PORT || '9000', 10),
    accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
    secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
    bucket: process.env.MINIO_BUCKET || 'devlens',
  },
  auth: {
    jwtSecret: process.env.JWT_SECRET || 'change-me-in-production',
  },
  logLevel: process.env.LOG_LEVEL || 'debug',
});
