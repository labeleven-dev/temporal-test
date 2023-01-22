import fetch from 'node-fetch';

export async function createOrder() {
  const response = await fetch('http://localhost:3000/order', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  });

  return response.json() as any as { orderId: string };
}

export async function submitPayment(orderId: string) {
  const response = await fetch(`http://localhost:3000/order/${orderId}/payment`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  });

  return response.json() as any as { orderId: string };
}

export async function signalPaymentResult(orderId: string, result: boolean) {
  const response = await fetch(`http://localhost:3000/order/${orderId}/payment/result`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ result })
  });

  return response.json() as any as { orderId: string };
}

export async function signalTransactionResult(orderId: string, result: boolean) {
  const response = await fetch(`http://localhost:3000/order/${orderId}/transaction/result`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ result })
  });

  return response.json() as any as { orderId: string };
}

export async function getOrderStatus(orderId: string) {
  const response = await fetch(`http://localhost:3000/order/${orderId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  });

  return response.json() as any as { orderId: string; status: string };
}
