/**
 * 演示模式和单元测试共用的 fixtures（SPEC 第 12 节）。
 * - sample-*.json：真实个人账号的 Graph 响应，已脱敏。
 * - synthetic.json：按 Graph 文档构造的合成数据，覆盖各种边界情况。
 */
import { cleanGraphObject } from "../core/graph/clean";
import type {
  GraphCollection,
  GraphTaskFileAttachment,
  GraphTodoTask,
  GraphTodoTaskList,
  RawData,
} from "../core/graph/types";
import sampleLists from "./sample-lists.json";
import sampleTasksDefault from "./sample-tasks-default.json";
import synthetic from "./synthetic.json";

export { sampleLists, sampleTasksDefault, synthetic };

type Collections = {
  lists: GraphCollection<GraphTodoTaskList>;
  tasksByListId: Record<string, GraphCollection<GraphTodoTask>>;
  attachmentsByTaskId?: Record<string, GraphCollection<GraphTaskFileAttachment>>;
};

/** 把按接口保存的响应合并成 RawData（与真实读取流程得到的结构一致）。 */
function toRawData(c: Collections): RawData {
  const unwrap = <T>(record: Record<string, GraphCollection<T>> = {}) =>
    Object.fromEntries(Object.entries(record).map(([k, v]) => [k, v.value]));
  return cleanGraphObject({
    lists: c.lists.value,
    tasksByListId: unwrap(c.tasksByListId),
    attachmentsByTaskId: unwrap(c.attachmentsByTaskId),
  });
}

/** 真实样例：两个清单，"任务" 里有两条任务，"🐶Baby购物清单" 为空。 */
export function sampleRawData(): RawData {
  return toRawData({
    lists: sampleLists as GraphCollection<GraphTodoTaskList>,
    tasksByListId: {
      LIST_DEFAULT: sampleTasksDefault as GraphCollection<GraphTodoTask>,
    },
  });
}

/** 合成数据。 */
export function syntheticRawData(): RawData {
  return toRawData(synthetic as unknown as Collections);
}
