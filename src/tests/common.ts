import fetch from "node-fetch";

export async function createOrder() {
    const response = await fetch('http://localhost:3000/order', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
    })

    return response.json() as any as { orderId: string };
}

export async function submitPayment(orderId: string) {
    const response = await fetch(`http://localhost:3000/order/${orderId}/payment`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
    });

    return response.json() as any as { orderId: string };
}

export async function getOrderStatus(orderId: string) {
    const response = await fetch(`http://localhost:3000/order/${orderId}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
    });

    return response.json() as any as { orderId: string, status: string };
}