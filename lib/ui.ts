import pEachSeries from 'p-each-series';
import { Clear, Progress } from 'clui';
import clic from 'cli-color';

export type Step = {
  title: string;
  execute: Execute;
};

export type ProgressFunc = (
  name: string,
  current: number,
  total: number
) => void;

export type Execute = (progress: ProgressFunc, prev: any) => Promise<any>;

export const steps = (...args: Step[]): Promise<void | Step[]> => {
  let prev: any = null;
  return pEachSeries(args, (step, i) => {
    const progressBar = new Progress(50);
    const updateProgress: ProgressFunc = (name, current, total) => {
      Clear();
      console.log(
        `${clic.cyan(`Step ${i + 1}/${args.length}`)} ${
          step.title
        }: ${clic.yellow(name)}`
      );
      console.log();
      console.log(progressBar.update(current, total));
      console.log(clic.cyan(`${Math.ceil(current)}/${total}`));
    };
    return new Promise((resolve, reject) => {
      step
        .execute(updateProgress, prev)
        .then(res => (prev = res))
        .then(res => {
          setTimeout(() => {
            resolve(res);
          }, 750);
        })
        .catch(err => {
          reject(err);
        });
    });
  }).catch(err => {
    console.log();
    console.log(`${clic.bgRedBright('Error')} ${err.message || err.code}`);
    if (err.stack) {
      console.log();
      console.log(err.stack);
    }
  });
};
