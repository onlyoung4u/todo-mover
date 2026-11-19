/**
 * 演示模式和单元测试共用的 fixtures（SPEC 第 12 节）。
 * - sample-*.json：真实个人账号的 Graph 响应，已脱敏。
 * - synthetic.json：按 Graph 文档构造的合成数据，覆盖各种边界情况。
 */
import sampleLists from "./sample-lists.json";
import sampleTasksDefault from "./sample-tasks-default.json";
import synthetic from "./synthetic.json";

export { sampleLists, sampleTasksDefault, synthetic };
