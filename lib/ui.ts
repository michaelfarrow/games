import pEachSeries from 'p-each-series';
import { Progress } from 'clui';
import clic from 'cli-color';

export type Step = {
  title: string;
  execute: Execute;
};

export type ProgressFuncArgs = [string, number?, number?];

export type ProgressFunc = (
  name: ProgressFuncArgs[0],
  current?: ProgressFuncArgs[1],
  total?: ProgressFuncArgs[2]
) => void;

export type Execute = (progress: ProgressFunc, prev: any) => Promise<any>;

type StepProgress = {
  step: number;
  progress: Progress;
  args: ProgressFuncArgs;
};

export const steps = (...steps: Step[]): Promise<void | Step[]> => {
  const stepsProgress: StepProgress[] = [];

  let prev: any = null;
  return pEachSeries(steps, (step, i) => {
    const progressBar = new Progress(50);
    const updateProgress: ProgressFunc = (...progressArgs) => {
      // return;
      if (!stepsProgress[i]) {
        stepsProgress[i] = {
          step: i,
          progress: progressBar,
          args: progressArgs
        };
      } else {
        stepsProgress[i].args = progressArgs.slice() as ProgressFuncArgs;
      }

      console.clear();
      stepsProgress.forEach(stepProgress => {
        const [name, current, total] = stepProgress.args;
        const currentStep = stepProgress.step === stepsProgress.length - 1;
        console.log(
          `${clic.cyan(`Step ${stepProgress.step + 1}/${steps.length}`)} ${
            steps[stepProgress.step].title
          }${(name && `: ${clic.yellow(name)}`) || ''}`
        );
        if (!currentStep) return;
        console.log();
        if (current !== undefined && total !== undefined) {
          console.log(stepProgress.progress.update(current, total));
          console.log(clic.cyan(`${Math.ceil(current)}/${total}`));
          console.log();
        }
      });
    };
    updateProgress('');
    return new Promise((resolve, reject) => {
      step
        .execute(updateProgress, prev)
        .then(res => (prev = res))
        .then(res => {
          setTimeout(() => {
            updateProgress('');
            resolve(res);
          }, 250);
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
