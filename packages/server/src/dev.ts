// Development entry: Vite owns the page and proxies /ws here, whatever PORT says.
process.env.PORT = '8787';
await import('./index');

export {};
