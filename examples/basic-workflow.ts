import { xflowFunction, XFlow, WorkflowSpec } from '../src/index';

// Stage 1: Validation functions
@xflowFunction({ stage: 1, name: 'validateUser' })
async function validateUser(data: { email: string }) {
  console.log(`Validating user: ${data.email}`);
  
  if (!data.email || !data.email.includes('@')) {
    throw new Error('Invalid email address');
  }
  
  return { valid: true, userId: `user_${Date.now()}` };
}

@xflowFunction({ stage: 1, name: 'validateOrder' })
async function validateOrder(data: { amount: number }) {
  console.log(`Validating order amount: $${data.amount}`);
  
  if (data.amount <= 0) {
    throw new Error('Order amount must be positive');
  }
  
  return { valid: true, orderId: `order_${Date.now()}` };
}

// Stage 2: Business logic functions
@xflowFunction({ stage: 2, name: 'processPayment' })
async function processPayment(data: { userId: string, amount: number }) {
  console.log(`Processing payment for user ${data.userId}: $${data.amount}`);
  
  // Simulate payment processing
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  return { 
    success: true, 
    transactionId: `txn_${Date.now()}`,
    amount: data.amount 
  };
}

@xflowFunction({ stage: 2, name: 'reserveInventory' })
async function reserveInventory(data: { orderId: string, items: string[] }) {
  console.log(`Reserving inventory for order ${data.orderId}`);
  
  return { 
    reserved: true, 
    reservationId: `res_${Date.now()}`,
    items: data.items 
  };
}

// Stage 3: Finalization functions
@xflowFunction({ stage: 3, name: 'sendConfirmation' })
async function sendConfirmation(data: { userId: string, transactionId: string }) {
  console.log(`Sending confirmation to user ${data.userId} for transaction ${data.transactionId}`);
  
  return { sent: true, emailId: `email_${Date.now()}` };
}

@xflowFunction({ stage: 3, name: 'updateAnalytics' })
async function updateAnalytics(data: { amount: number, userId: string }) {
  console.log(`Updating analytics for user ${data.userId}: $${data.amount}`);
  
  return { updated: true, analyticsId: `analytics_${Date.now()}` };
}

// Define the workflow
const orderProcessingWorkflow: WorkflowSpec = {
  name: 'Order Processing Workflow',
  description: 'Complete order processing from validation to confirmation',
  stages: [
    {
      id: 'validate-user',
      function: 'validateUser',
      params: { email: 'customer@example.com' }
    },
    {
      id: 'validate-order',
      function: 'validateOrder', 
      params: { amount: 99.99 }
    },
    {
      id: 'process-payment',
      function: 'processPayment',
      params: { userId: 'user_123', amount: 99.99 },
      dependsOn: ['validate-user', 'validate-order']
    },
    {
      id: 'reserve-inventory',
      function: 'reserveInventory',
      params: { orderId: 'order_123', items: ['item1', 'item2'] },
      dependsOn: ['validate-order']
    },
    {
      id: 'send-confirmation',
      function: 'sendConfirmation',
      params: { userId: 'user_123', transactionId: 'txn_123' },
      dependsOn: ['process-payment']
    },
    {
      id: 'update-analytics',
      function: 'updateAnalytics',
      params: { amount: 99.99, userId: 'user_123' },
      dependsOn: ['process-payment']
    }
  ]
};

// Test function
export async function runTest() {
  console.log('🚀 Starting XFlow SDK Test...');
  
  try {
    // Initialize SDK (point to your local Temporal server)
    const xflow = new XFlow({
      temporalAddress: 'localhost:7233',
      useSSL: true,
      jwtTokenPath: '../xflow-poc/src/auth/admin-token.jwt',
      certificates: {
        clientCert: '../xflow-poc/certs/worker-client.pem',
        clientKey: '../xflow-poc/certs/worker-client-key.pem',
        caCert: '../xflow-poc/certs/ca.pem'
      }
    });
    
    // Initialize and start workers
    console.log('📋 Initializing SDK...');
    await xflow.initialize();
    
    console.log('🔧 Starting workers...');
    await xflow.startWorkers();
    
    // Execute the workflow
    console.log('🎯 Executing workflow...');
    const result = await xflow.executeWorkflow(orderProcessingWorkflow);
    
    console.log('✅ Workflow completed:', result);
    
    // Cleanup
    await xflow.shutdown();
    
    return result;
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  runTest()
    .then(() => {
      console.log('🎉 Test completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Test failed:', error);
      process.exit(1);
    });
} 