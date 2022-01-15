import { Duration, Time, areEqual } from "@foxglove/rostime";
import { VendorId } from "@foxglove/rtps";

export const MAX_TIME: Time = { nsec: 4294967295, sec: 2147483647 };

export enum DdsTopicType {
  Topic = "t",
  ServiceRequest = "q",
  ServiceResponse = "r",
  Parameter = "p",
  Action = "a",
}

/**
 * Converts a ROS 2 topic name to a DDS topic name by prefixing rt/ if a ROS 2 prefix is not already
 * present
 * @param topic ROS 2 topic name
 * @returns DDS topic name
 */
export function rosTopicToDds(topic: string): string {
  if (/^r[tqrpa]\/.+/.test(topic)) {
    return topic;
  } else if (topic.startsWith("/")) {
    return "rt" + topic;
  } else {
    return "rt/" + topic;
  }
}

/**
 * Converts a DDS topic name back into a ROS 2 topic name and type by removing the r[?]/ prefix. Returns
 * undefined if this is not a valid ROS 2 mangled name
 * @param ddsTopic DDS topic name
 * @returns An object containing the topic name and type on success, or undefined on failure
 */
export function ddsToRosTopic(ddsTopic: string): { topic: string; kind: DdsTopicType } | undefined {
  if (/^r[tqrpa]\/.+/.test(ddsTopic)) {
    const topic = ddsTopic.substring(2);
    const kind = ddsTopic[1] as DdsTopicType;
    return { topic, kind };
  }
  return undefined;
}

/**
 * Converts a ROS 2 type such as "std_msgs/msg/String" to the DDS type name
 * "std_msgs::msg::dds_::String_". If the ROS 2 type name does not follow ROS 2 naming conventions
 * of {namespace}/{type}/{name} it will return undefined
 * @param dataType ROS 2 data type
 * @returns DDS type name on success, otherwise undefined
 */
export function rosTypeToDds(dataType: string): string | undefined {
  const parts = dataType.split("/");
  if (parts.length === 3) {
    const namespace = parts[0]!;
    const defType = parts[1]!;
    const typeName = parts[2]!;
    if (namespace.length > 0 && defType.length > 0 && typeName.length > 0) {
      return `${namespace}::${defType}::dds_::${typeName}_`;
    }
  }
  return undefined;
}

/**
 * Converts a DDS type name such as "std_msgs::msg::dds_::String_" to the ROS 2 type name
 * "std_msgs/msg/String". If the DDS type name does not follow ROS 2 DDS mangling conventions,
 * undefined is returned
 * @param dataType DDS type name
 * @returns ROS 2 data type on success, otherwise undefined
 */
export function ddsToRosType(ddsType: string): string | undefined {
  const parts = ddsType.split("::");
  if (parts.length === 4) {
    const namespace = parts[0]!;
    const defType = parts[1]!;
    const dds = parts[2]!;
    let typeName = parts[3]!;
    if (dds === "dds_" && typeName.endsWith("_")) {
      typeName = typeName.substring(0, typeName.length - 1);
      return `${namespace}/${defType}/${typeName}`;
    }
  }
  return undefined;
}

export function vendorName(vendorId: VendorId): string {
  return VendorId[vendorId] ?? `0x${vendorId.toString(16)}`;
}

export function durationToString(duration: Duration): string {
  if (areEqual(duration, MAX_TIME)) {
    return "Infinite";
  }
  return `${duration.sec}s ${duration.nsec}ns`;
}
