import { createOrder, getOrderStatus, submitPayment } from './common.js';

async function run1() {
    const { orderId } = await createOrder();
    console.log(`Created order ${orderId}`);

    console.log(`Order status is ${await getOrderStatus(orderId).then(x => x.status)}`);

    // call submit payment api POST /order/{orderId}/payment using fetch
    await submitPayment(orderId);
    console.log(`Submitted payment for ${orderId}`);

    console.log(`Order status is ${await getOrderStatus(orderId).then(x => x.status)}`);

    // sleep for 5 seconds
    await new Promise(resolve => setTimeout(resolve, 5000));
    console.log(`Order status is ${await getOrderStatus(orderId).then(x => x.status)}`);

    // sleep for 5 seconds
    await new Promise(resolve => setTimeout(resolve, 6000));
    console.log(`Order status is ${await getOrderStatus(orderId).then(x => x.status)}`);
}

async function run2() {
    const { orderId } = await createOrder();
    console.log(`Created order ${orderId}`);

    console.log(`Order status is ${await getOrderStatus(orderId).then(x => x.status)}`);

    // sleep for 5 seconds
    await new Promise(resolve => setTimeout(resolve, 5000));
    console.log(`Order status is ${await getOrderStatus(orderId).then(x => x.status)}`);

    // sleep for 5 seconds
    await new Promise(resolve => setTimeout(resolve, 6000));
    console.log(`Order status is ${await getOrderStatus(orderId).then(x => x.status)}`);
}

await run1();
await run2();