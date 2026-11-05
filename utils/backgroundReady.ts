let pending:Promise<void>=Promise.resolve();
export function trackBackground(task:Promise<void>){pending=task;void task.catch(()=>{});}
export async function waitForBackground(){await pending;}
