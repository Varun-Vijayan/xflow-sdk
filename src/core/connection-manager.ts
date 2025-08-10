// Connection Manager for XFlow SDK
// Handles SSL certificates, JWT tokens, and Temporal connections

import { NativeConnection } from '@temporalio/worker';
import * as fs from 'fs';
import * as path from 'path';
import { XFlowConfig } from '../types/index';
import { TemporalConnectionOptions, CertificatePaths, JWTInfo } from '../types/internal';

/**
 * Manages connections to Temporal server with SSL and JWT authentication
 * Matches the POC's authentication patterns
 */
export class ConnectionManager {
  private config: XFlowConfig;
  private connection: NativeConnection | null = null;
  private jwtInfo: JWTInfo | null = null;
  private certificatePaths: CertificatePaths | null = null;

  constructor(config: XFlowConfig) {
    this.config = config;
  }

  /**
   * Create or get existing connection to Temporal
   */
  async getConnection(): Promise<NativeConnection> {
    if (this.connection) {
      return this.connection;
    }

    console.log('🔗 Creating connection to Temporal server...');
    
    const connectionOptions = await this.buildConnectionOptions();
    this.connection = await NativeConnection.connect(connectionOptions);
    
    console.log('✅ Connected to Temporal server successfully');
    return this.connection;
  }

  /**
   * Test connection to Temporal server
   */
  async testConnection(): Promise<void> {
    try {
      const connection = await this.getConnection();
      // Simple test - if we got here, connection works
      console.log('🧪 Connection test successful');
    } catch (error) {
      console.error('❌ Connection test failed:', error);
      throw new Error(`Cannot connect to Temporal server: ${error}`);
    }
  }

  /**
   * Build connection options based on configuration
   * Matches POC's SSL + JWT pattern
   */
  private async buildConnectionOptions(): Promise<TemporalConnectionOptions> {
    const address = this.normalizeAddress(this.config.temporalAddress);
    console.log('🔍 Connecting to:', address, this.config.useSSL ? '(with SSL)' : '(without SSL)');

    const options: TemporalConnectionOptions = {
      address
    };

    // Add JWT authentication if available
    const jwtInfo = await this.loadJWTToken();
    if (jwtInfo) {
      options.metadata = {
        authorization: `Bearer ${jwtInfo.token}`
      };
      console.log(`🔑 JWT token loaded from ${jwtInfo.source}${jwtInfo.path ? ` (${jwtInfo.path})` : ''}`);
    }

    // Add SSL/TLS configuration if needed
    if (this.config.useSSL) {
      const tlsConfig = await this.loadSSLCertificates();
      if (tlsConfig) {
        options.tls = tlsConfig;
        console.log('🔐 SSL certificates loaded successfully');
      } else {
        // Use basic TLS without client certificates (for HTTPS endpoints)
        options.tls = {};
        console.log('🔐 Using basic TLS (no client certificates)');
      }
    }

    return options;
  }

  /**
   * Normalize Temporal server address
   * Handles GitHub Codespaces and HTTPS URLs like the POC
   */
  private normalizeAddress(rawAddress: string): string {
    if (rawAddress.startsWith('https://')) {
      // Extract hostname from HTTPS URL and use port 443
      const url = new URL(rawAddress);
      return `${url.hostname}:443`;
    } else if (rawAddress.includes('github.dev')) {
      // Handle github.dev domains without https prefix
      const hostname = rawAddress.replace(/^https?:\/\//, '').replace(/\/$/, '');
      return `${hostname}:443`;
    } else {
      // Local or standard hostname:port
      return rawAddress;
    }
  }

  /**
   * Load JWT token from various sources
   * Matches POC's JWT loading pattern
   */
  private async loadJWTToken(): Promise<JWTInfo | null> {
    if (this.jwtInfo) {
      return this.jwtInfo;
    }

    // Try config first
    if (this.config.jwtToken) {
      this.jwtInfo = {
        token: this.config.jwtToken,
        source: 'config'
      };
      return this.jwtInfo;
    }

    // Try environment variable
    if (process.env.XFLOW_JWT_TOKEN) {
      this.jwtInfo = {
        token: process.env.XFLOW_JWT_TOKEN,
        source: 'environment'
      };
      return this.jwtInfo;
    }

    // Try file (matches POC pattern)
    const tokenPaths = [
      this.config.jwtTokenPath || './xflow-token.jwt',
      './src/auth/admin-token.jwt', // POC location
      './admin-token.jwt',
      './token.jwt'
    ];

    for (const tokenPath of tokenPaths) {
      try {
        if (fs.existsSync(tokenPath)) {
          const token = fs.readFileSync(tokenPath, 'utf8').trim();
          if (token) {
            this.jwtInfo = {
              token,
              source: 'file',
              path: tokenPath
            };
            return this.jwtInfo;
          }
        }
      } catch (error) {
        console.log(`Could not read JWT token from ${tokenPath}:`, error);
      }
    }

    console.log('⚠️  No JWT token found. This may be required depending on your Temporal server configuration.');
    return null;
  }

  /**
   * Load SSL certificates for mTLS
   * Matches POC's certificate loading pattern
   */
  private async loadSSLCertificates(): Promise<any> {
    if (this.certificatePaths) {
      return this.loadCertificatesFromPaths(this.certificatePaths);
    }

    // Use explicit certificate configuration if provided
    if (this.config.certificates) {
      this.certificatePaths = this.config.certificates;
      return this.loadCertificatesFromPaths(this.certificatePaths);
    }

    // Auto-discover certificates if enabled (matches POC structure)
    if (this.config.autoDiscoverCertificates !== false) {
      const discoveredPaths = this.discoverCertificatePaths();
      if (discoveredPaths) {
        this.certificatePaths = discoveredPaths;
        return this.loadCertificatesFromPaths(this.certificatePaths);
      }
    }

    return null;
  }

  /**
   * Auto-discover certificate paths (matches POC's ./certs/ structure)
   */
  private discoverCertificatePaths(): CertificatePaths | null {
    const possiblePaths = [
      {
        clientCert: './certs/worker-client.pem',
        clientKey: './certs/worker-client-key.pem',
        caCert: './certs/ca.pem'
      },
      {
        clientCert: './certs/client.pem',
        clientKey: './certs/client-key.pem', 
        caCert: './certs/ca.pem'
      },
      {
        clientCert: './client.pem',
        clientKey: './client-key.pem',
        caCert: './ca.pem'
      }
    ];

    for (const paths of possiblePaths) {
      if (this.certificatesExist(paths)) {
        console.log('🔍 Auto-discovered SSL certificates in:', path.dirname(paths.clientCert));
        return paths;
      }
    }

    return null;
  }

  /**
   * Check if certificate files exist
   */
  private certificatesExist(paths: CertificatePaths): boolean {
    return fs.existsSync(paths.clientCert) && 
           fs.existsSync(paths.clientKey) && 
           fs.existsSync(paths.caCert);
  }

  /**
   * Load certificates from file paths
   */
  private loadCertificatesFromPaths(paths: CertificatePaths): any {
    try {
      const clientCert = fs.readFileSync(paths.clientCert);
      const clientKey = fs.readFileSync(paths.clientKey);
      const caCert = fs.readFileSync(paths.caCert);

      return {
        serverRootCACertificate: caCert,
        clientCertPair: {
          crt: clientCert,
          key: clientKey
        },
        serverNameOverride: this.config.certificates?.serverName
      };
    } catch (error) {
      console.error('❌ Failed to load SSL certificates:', error);
      throw new Error(`SSL certificate loading failed: ${error}`);
    }
  }

  /**
   * Close the connection
   */
  async close(): Promise<void> {
    if (this.connection) {
      await this.connection.close();
      this.connection = null;
      console.log('🔌 Connection to Temporal server closed');
    }
  }

  /**
   * Get connection status information
   */
  getStatus() {
    return {
      connected: !!this.connection,
      address: this.config.temporalAddress,
      useSSL: this.config.useSSL,
      hasJWT: !!this.jwtInfo,
      jwtSource: this.jwtInfo?.source,
      hasCertificates: !!this.certificatePaths,
      certificatesPath: this.certificatePaths ? path.dirname(this.certificatePaths.clientCert) : null
    };
  }
}