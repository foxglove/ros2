import { rosTopicToDds, rosTypeToDds } from "./rosToDds";

describe("rosTopicToDds", () => {
  it("should convert ROS topics to DDS topics", () => {
    expect(rosTopicToDds("/foo/bar")).toEqual("rt/foo/bar");
    expect(rosTopicToDds("foo/bar")).toEqual("rt/foo/bar");
    expect(rosTopicToDds("rt/foo/bar/baz")).toEqual("rt/foo/bar/baz");
    expect(rosTopicToDds("rq/foo")).toEqual("rq/foo");
    expect(rosTopicToDds("rr/foo")).toEqual("rr/foo");
    expect(rosTopicToDds("rs/foo")).toEqual("rs/foo");
    expect(rosTopicToDds("rp/foo")).toEqual("rp/foo");
    expect(rosTopicToDds("ra/foo")).toEqual("ra/foo");
    expect(rosTopicToDds("rx/foo")).toEqual("rt/rx/foo");
  });
});

describe("rosTypeToDds", () => {
  it("should convert ROS types to DDS types", () => {
    expect(rosTypeToDds("std_msgs/msg/String")).toEqual("std_msgs::msg::dds_::String_");
    expect(rosTypeToDds("std_msgs/String")).toEqual("std_msgs::msg::dds_::String_");
    expect(rosTypeToDds("foo")).toEqual("foo");
    expect(rosTypeToDds("foo/bar")).toEqual("foo::msg::dds_::bar_");
    expect(rosTypeToDds("foo/bar/baz")).toEqual("foo::bar::dds_::baz_");
    expect(rosTypeToDds("foo/bar/baz/quux")).toEqual("foo::bar::baz::quux");
  });
});
