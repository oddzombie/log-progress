# log-progress
Simple node spinners and progress bars.

```javascript
const LogProgress = require('@ih/log-progress');
const lp = new LogProgress({
  tasks: [
    { name: 'A fast task', promise: new Promise((resolve, reject) => setTimeout(resolve, 100)) },
    { name: 'A failed promise', promise: new Promise((resolve, reject) => setTimeout(reject, 200)) },
    { name: 'Progress Bar', total: 500 },
  ]
}).start();

const someAsyncTask = new Promise((resolve, reject) => setTimeout(() => resolve('hi'), 1000));
lp.logTask({ name: 'another task', promise: someAsyncTask });
console.log('normal log');
console.error('error');

let i = 0;
const interval = setInterval(() => {
  lp.task('Progress Bar').update({ progress: ++i });
  if (i >= 500) {
    clearInterval(interval);
    lp.stop();
  }
}, 20);
```