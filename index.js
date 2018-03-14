const logUpdate = require('log-update');
const chalk = require('chalk');
const windowSize = require('window-size');

const STATUS = { pending: 'PENDING', fulfilled: 'FULFILLED', rejected: 'REJECTED' };
const frames = ['-', '\\', '|', '/'];

class Task {
  constructor(opt) {
    this.name = opt.name;
    this.status = opt.status || '';
    this.progress = opt.progress || null;
    this.total = opt.total || null;
    this.promise = null;
    this.startTime = Date.now();

    if (opt.promise && opt.promise instanceof Promise) {
      this.promise = opt.promise;
      this.promise.then(() => this.state = STATUS.fulfilled, () => this.state = STATUS.rejected);
    }
    this.state = STATUS.pending;
  }

  progressBar() {
    const completed = 100 * ( this.progress / this.total );
    const info = ` ${completed < 10 ? ' ' : ''}${completed.toFixed(2)}% (${this.progress} / ${this.total}) elapsed: ${this.formatTime(this.elapsedTime(this.startTime))}, eta: ${this.formatTime(this.timeRemaining(this.startTime, this.progress, this.total))}`;
    const width = windowSize.width - (info.length + 4);
    const completedLength = Math.floor(completed / (100 / width));
    return `${chalk.green('\u2588'.repeat(Math.max(0, completedLength + 1)))}${'\u2591'.repeat(Math.max(0, (width - 1) - completedLength))}${info}`;
  }

  toString(frame) {
    let result = '';
    switch(this.state) {
      case(STATUS.fulfilled):
        result = chalk.green(`\u2713 ${this.name}`);
        break;
      
      case(STATUS.rejected):
        result = chalk.red(`X ${this.name}`);
        break;

      default:
        result = `${chalk.blue(frames[frame])} ${this.name}`;
    }
    
    if (this.status) {
      result += ` ${this.status}`;
    }
    
    if (this.total && this.state !== STATUS.fulfilled) {
      result += `\n ${this.progressBar()}\n`;
    }
    return result;
  }

  update(opt) {
    this.progress = opt.progress;
    this.total = opt.total || this.total;
    this.status = opt.status || this.status;
    if (this.progress >= this.total) {
      this.state = STATUS.fulfilled;
    }
    return this;
  }

  elapsedTime(startTime) {
    return (Date.now() - startTime) / 1000;
  }

  timeRemaining(startTime, progress, total) {
    return (this.elapsedTime(startTime) / progress) * (total - progress);
  }

  formatTime(time) {
    const hours = Math.floor(time / 3600);
    if (hours > 99) {
      return '--:--:--';
    }
    const minutes = Math.floor((time % 3600) / 60);
    const seconds = Math.floor(time % 3600 % 60);
    return `${hours}:${minutes < 10 ? '0' : ''}${minutes}:${seconds < 10 ? '0': ''}${seconds}`;
  };
}

class LogProgress {
  constructor(opt) {
    this.i = 0;
    this.tasks = [];
    if (opt && opt.tasks) {
      opt.tasks.forEach(task => this.logTask(task));
    }
    this.logs = [];
  }

  start() {
    this.consoleLog = console.log;
    this.consoleError = console.error;
    console.log = text => this.logs.push({ value: text.toString(), type: 'LOG' });
    console.error = error => this.logs.push({ value: error.toString(), type: 'ERROR' });
    this.interval = setInterval(() => this.tick(), 80);
    return this;
  }

  stop() {
    this.tick();
    console.log = this.consoleLog;
    console.error = this.consoleError;
    clearInterval(this.interval);
    return this;
  }

  tick() {
    this.i = ++this.i % frames.length;
    const now = Date.now()
    this.tasks = this.tasks.filter(task => !(task.removeWhenComplete && task.removeAtTime && now >= task.removeAtTime));
    let update = '';
    if (this.logs.length) {
      update += this.logs.map(log => log.type === 'ERROR' ? chalk.red(log.value) : log.value ).join('\n') + '\n';
    }
    update += this.tasks.map(task => task.toString(this.i)).join('\n')
    logUpdate(update);
    return this;
  }

  logTask(task) {
    this.tasks.push(new Task(task));
    return task.promise;
  }

  logPromise(name, promise) {
    return this.logTask({ name, promise });
  }

  logProgress(name, totalCount, progress) {
    return this.logTask({ name, progress, totalCount });
  }

  removeTask(name) {
    const task = this.task(name);
    this.tasks = this.tasks.filter(item => item !== task);
  }

  clearTasks() {
    this.tasks = [];
  }

  task(name) {
    if (name instanceof Task) {
      return name;
    }
    if (typeof name === 'object' && name.name) {
      name = name.name;
    }
    return this.tasks.find(task => task.name === name);
  }
}

module.exports = LogProgress;