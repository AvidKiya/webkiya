import{endpoint,ok}from'@/server/http';import{listManualPayments}from'@/server/manual-payments';export async function GET(r:Request){return endpoint(async()=>ok(await listManualPayments(r)));}
