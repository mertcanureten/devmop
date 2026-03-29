import chalk from "chalk";
import prettyBytes from "pretty-bytes";

export function drawBarChart(data) {
  const maxLabelLength = Math.max(...data.map(d => d.label.length));
  const totalSize = data.reduce((acc, d) => acc + d.value, 0);
  const maxWidth = 40;

  console.log(chalk.bold("\nDisk Usage Breakdown:"));
  console.log("=".repeat(maxWidth + maxLabelLength + 15));

  for (const item of data) {
    const percentage = item.value / (totalSize || 1);
    const barWidth = Math.round(percentage * maxWidth);
    const bar = "█".repeat(barWidth) + "░".repeat(maxWidth - barWidth);
    const label = item.label.padEnd(maxLabelLength);
    const size = prettyBytes(item.value).padStart(10);
    
    console.log(`${chalk.cyan(label)} [${chalk.blue(bar)}] ${chalk.yellow(size)}`);
  }

  console.log("=".repeat(maxWidth + maxLabelLength + 15));
  console.log(`${chalk.bold("Total Recoverable:")} ${chalk.green(prettyBytes(totalSize))}\n`);
}
