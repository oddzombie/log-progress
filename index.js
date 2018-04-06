const logUpdate = require('log-update');
const chalk = require('chalk');
const windowSize = require('window-size');

const STATUS = {
  pending: 'PENDING',
  fulfilled: 'FULFILLED',
  rejected: 'REJECTED',
};
const frames = ['-', '\\', '|', '/'];

const formatTime = function(time) {
  const hours = Math.floor(time / 3600);
  if (hours > 99) {
    return '--:--:--';
  }
  const minutes = Math.floor((time % 3600) / 60);
  const seconds = Math.floor((time % 3600) % 60);
  return `${hours}:${minutes < 10 ? '0' : ''}${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
};

const elapsedTime = function(startTime) {
  return (Date.now() - startTime) / 1000;
};

const timeRemaining = function(startTime, progress, total) {
  return elapsedTime(startTime) / progress * (total - progress);
};

const progressBar = function(progress, total, text) {
  const completed = 100 * (progress / total);
  let info = ` ${completed < 10 ? ' ' : ''}${completed.toFixed(2)}% (${progress} / ${total})`;
  if (text) {
    info += ` ${text}`;
  }
  const width = windowSize.width - (info.length + 4);
  const completedLength = Math.floor(completed / (100 / width));
  return `${chalk.green('\u2588'.repeat(Math.max(0, completedLength + 1)))}${chalk.grey(
    '\u2591'.repeat(Math.max(0, width - 1 - completedLength)),
  )}${info}`;
};

const printProgress = function(progress, total, startTime) {
  let timeInfo = null;
  if (startTime) {
    timeInfo = `elapsed: ${formatTime(elapsedTime(startTime))}`;
    if (progress < total) {
      timeInfo += `, eta: ${formatTime(timeRemaining(startTime, progress, total))}`;
    }
  }
  process.stdout.clearLine();
  process.stdout.cursorTo(2);
  process.stdout.write(progressBar(progress < total ? progress : total, total, timeInfo));
  process.stdout.cursorTo(2);
};

const printTimeRemaining = function(startTime, progress, total) {
  process.stdout.clearLine();
  process.stdout.cursorTo(2);
  process.stdout.write(formatTime(timeRemaining(startTime, progress, total)));
};

class Task {
  constructor(opt) {
    this.name = opt.name;
    this.status = opt.status || '';
    this.progress = opt.progress || null;
    this.total = opt.total || null;
    this.promise = null;
    this.startTime = Date.now();
    this.completedTime = null;

    if (opt.promise && opt.promise instanceof Promise) {
      this.promise = opt.promise;
      this.promise.then(
        () => {
          this.state = STATUS.fulfilled;
          this.completedTime = elapsedTime(this.startTime);
        },
        () => {
          this.state = STATUS.rejected;
          this.completedTime = elapsedTime(this.startTime);
        },
      );
    }
    this.state = STATUS.pending;
  }

  toString(frame) {
    let result = '';
    switch (this.state) {
      case STATUS.fulfilled:
        result = chalk.green(`\u2713 ${this.name}`);
        break;

      case STATUS.rejected:
        result = chalk.red(`X ${this.name}`);
        break;

      default:
        result = `${chalk.blue(frames[frame])} ${this.name}`;
    }

    result += ` (${formatTime(this.completedTime ? this.completedTime : elapsedTime(this.startTime))})`;
    if (this.total && this.state === STATUS.pending) {
      result += ` eta: ${formatTime(timeRemaining(this.startTime, this.progress, this.total))}`;
    }

    if (this.status) {
      result += ` ${this.status}`;
    }

    if (this.total && this.state !== STATUS.fulfilled) {
      result += `\n ${progressBar(this.progress, this.total)}\n`;
    }
    return result;
  }

  update(opt) {
    this.progress = opt.progress;
    this.total = opt.total || this.total;
    this.status = opt.status || this.status;
    if (this.state === STATUS.pending && this.progress >= this.total) {
      this.state = STATUS.fulfilled;
      this.completedTime = elapsedTime(this.startTime);
    }
    return this;
  }
}

class LogProgress {
  constructor(opt) {
    this.i = 0;
    this.tasks = [];
    if (opt && opt.tasks) {
      opt.tasks.forEach((task) => this.logTask(task));
    }
  }

  start() {
    this.consoleLog = console.log;
    this.consoleError = console.error;
    console.log = this.write('LOG');
    console.error = this.write('ERROR');
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
    const now = Date.now();
    this.tasks = this.tasks.filter(
      (task) => !(task.removeWhenComplete && task.removeAtTime && now >= task.removeAtTime),
    );
    logUpdate(this.tasks.map((task) => task.toString(this.i)).join('\n'));
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
    this.logTask({ name, progress, totalCount });
    return this.task(name);
  }

  removeTask(name) {
    const task = this.task(name);
    this.tasks = this.tasks.filter((item) => item !== task);
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
    return this.tasks.find((task) => task.name === name);
  }

  write(type) {
    return (text) => {
      logUpdate.clear();
      process.stdout.clearLine();
      process.stdout.cursorTo(0);
      if (type === 'ERROR') {
        this.consoleError(chalk.red(text));
      } else {
        this.consoleLog(text);
      }
      this.tick();
    };
  }
}

module.exports = LogProgress;
module.exports.elapsedTime = elapsedTime;
module.exports.formatTime = formatTime;
module.exports.LogProgress = LogProgress;
module.exports.printProgress = printProgress;
module.exports.printTimeRemaining = printTimeRemaining;
module.exports.Task = Task;
module.exports.timeRemaining = timeRemaining;
