/**
 * Converts a ROS 2 topic name to a DDS topic name by prefixing rt/ if a ROS 2 prefix is not already
 * present
 * @param topic ROS 2 topic name
 * @returns DDS topic name
 */
export function rosTopicToDds(topic: string): string {
  if (/^r[tqrspa]\/.+/.test(topic)) {
    return topic;
  } else if (topic.startsWith("/")) {
    return "rt" + topic;
  } else {
    return "rt/" + topic;
  }
}

/**
 * Converts a ROS 2 type such as "std_msgs/msg/String" to the DDS type name
 * "std_msgs::msg::dds_::String_"
 * @param dataType ROS 2 data type
 * @returns DDS type name
 */
export function rosTypeToDds(dataType: string): string {
  const parts = dataType.split("/");
  if (parts.length === 2) {
    const namespace = parts[0]!;
    const typeName = parts[1]!;
    return `${namespace}::msg::dds_::${typeName}_`;
  } else if (parts.length === 3) {
    const namespace = parts[0]!;
    const defType = parts[1]!;
    const typeName = parts[2]!;
    return `${namespace}::${defType}::dds_::${typeName}_`;
  } else {
    return dataType.replace(/\//g, "::");
  }
}
