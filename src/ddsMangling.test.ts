import {
  DdsTopicType,
  ddsToRosTopic,
  ddsToRosType,
  rosTopicToDds,
  rosTypeToDds,
} from "./ddsMangling";

describe("rosTopicToDds", () => {
  it("should convert ROS topics to DDS topics", () => {
    expect(rosTopicToDds("/foo/bar")).toEqual("rt/foo/bar");
    expect(rosTopicToDds("foo/bar")).toEqual("rt/foo/bar");
    expect(rosTopicToDds("rt/foo/bar/baz")).toEqual("rt/foo/bar/baz");
    expect(rosTopicToDds("rq/foo")).toEqual("rq/foo");
    expect(rosTopicToDds("rr/foo")).toEqual("rr/foo");
    expect(rosTopicToDds("rp/foo")).toEqual("rp/foo");
    expect(rosTopicToDds("ra/foo")).toEqual("ra/foo");
    expect(rosTopicToDds("rx/foo")).toEqual("rt/rx/foo");
  });
});

describe("ddsToRosTopic", () => {
  it("should convert DDS topics to ROS topics", () => {
    expect(ddsToRosTopic("rt/foo/bar")).toEqual({ topic: "/foo/bar", kind: DdsTopicType.Topic });
    expect(ddsToRosTopic("rt/foo/bar/baz")).toEqual({ topic: "/foo/bar/baz", kind: DdsTopicType.Topic }); // prettier-ignore
    expect(ddsToRosTopic("rq/foo")).toEqual({ topic: "/foo", kind: DdsTopicType.ServiceRequest });
    expect(ddsToRosTopic("rr/foo")).toEqual({ topic: "/foo", kind: DdsTopicType.ServiceResponse });
    expect(ddsToRosTopic("rp/foo")).toEqual({ topic: "/foo", kind: DdsTopicType.Parameter });
    expect(ddsToRosTopic("ra/foo")).toEqual({ topic: "/foo", kind: DdsTopicType.Action });
    expect(ddsToRosTopic("rx/foo")).toEqual(undefined);
    expect(ddsToRosTopic("foo")).toEqual(undefined);
    expect(ddsToRosTopic("rt")).toEqual(undefined);
    expect(ddsToRosTopic("rt/")).toEqual(undefined);
  });
});

describe("rosTypeToDds", () => {
  it("should convert ROS types to DDS types", () => {
    expect(rosTypeToDds("std_msgs/msg/String")).toEqual("std_msgs::msg::dds_::String_");
    expect(rosTypeToDds("a/b/c")).toEqual("a::b::dds_::c_");
    expect(rosTypeToDds("a/b/c/d")).toEqual(undefined);
    expect(rosTypeToDds("/b/c")).toEqual(undefined);
    expect(rosTypeToDds("a//c")).toEqual(undefined);
    expect(rosTypeToDds("a/b/")).toEqual(undefined);
    expect(rosTypeToDds("a/b/c/")).toEqual(undefined);
    expect(rosTypeToDds("/a/b/c")).toEqual(undefined);
  });
});

describe("ddsToRosType", () => {
  it("should convert DDS types to ROS types", () => {
    expect(ddsToRosType("std_msgs::msg::dds_::String_")).toEqual("std_msgs/msg/String");
    expect(ddsToRosType("a::b::dds_::c_")).toEqual("a/b/c");
    expect(ddsToRosType("a")).toEqual(undefined);
    expect(ddsToRosType("a::b")).toEqual(undefined);
    expect(ddsToRosType("a::b::c")).toEqual(undefined);
    expect(ddsToRosType("a::b::dds_::c")).toEqual(undefined);
    expect(ddsToRosType("a::b::dds::c_")).toEqual(undefined);
  });
});
