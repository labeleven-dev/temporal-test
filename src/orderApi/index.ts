import { Client, Workflow, WorkflowHandle } from '@temporalio/client';
import express, { Request, Response } from 'express';
import { uuid4 } from '@temporalio/workflow';
import {
  QUERY_ORDER_STATE,
  SIGNAL_PAYMENT_RESULT,
  SIGNAL_SUBMIT_PAYMENT,
  SIGNAL_TRANSACTION_RESULT,
  TASK_QUEUE_ORDER,
  WORKFLOW_NAME_ORDER
} from '../consts.js';

const app = express();
const port = 3000;
const client = new Client();

app.use(express.json());

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.post('/order', async (req, res) => {
  const orderId = uuid4();
  const workflowId = `order-${orderId}`;

  await client.workflow.start(WORKFLOW_NAME_ORDER, {
    taskQueue: TASK_QUEUE_ORDER,
    workflowId,
    args: [orderId]
  });

  res.json({
    orderId
  });
});

const handleOrderError = async (orderId: string, workflow: WorkflowHandle<Workflow>, err: unknown, res: Response<any>) => {
  const status = await workflow.query<string, []>(QUERY_ORDER_STATE);

  if (status) {
    res.status(400).json({
      orderId,
      status
    });
  } else {
    res.status(404).json({
      orderId,
      status: 'NOT_FOUND'
    });
  }
};

const getOrderWorkflow = (orderId: string) => {
  const workflowId = `order-${orderId}`;
  const workflow = client.workflow.getHandle(workflowId);
  return { orderId, workflow };
};

app.post('/order/:id/payment', async (req, res) => {
  const { orderId, workflow } = getOrderWorkflow(req.params.id);
  try {
    await workflow.signal(SIGNAL_SUBMIT_PAYMENT, 'paymentInfo');

    res.json({
      orderId
    });
  } catch (err) {
    handleOrderError(orderId, workflow, err, res);
  }
});

app.post('/order/:id/payment/result', async (req, res) => {
  const { orderId, workflow } = getOrderWorkflow(req.params.id);
  const result = req.body.result;

  try {
    await workflow.signal(SIGNAL_PAYMENT_RESULT, result);

    res.json({
      orderId
    });
  } catch (err) {
    handleOrderError(orderId, workflow, err, res);
  }
});

app.post('/order/:id/transaction/result', async (req, res) => {
  const { orderId, workflow } = getOrderWorkflow(req.params.id);
  const result = req.body.result;

  try {
    await workflow.signal(SIGNAL_TRANSACTION_RESULT, result);

    res.json({
      orderId
    });
  } catch (err) {
    handleOrderError(orderId, workflow, err, res);
  }
});

app.get('/order/:id', async (req, res) => {
  const orderId = req.params.id;
  const workflowId = `order-${orderId}`;

  const workflow = client.workflow.getHandle(workflowId);
  const status = await workflow.query<string, []>(QUERY_ORDER_STATE);

  res.json({
    orderId,
    status
  });
});

app.listen(port, () => {
  console.log(`Order service listening at http://localhost:${port}`);
});
