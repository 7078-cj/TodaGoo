// .svg imports (react-native-svg-transformer) as a plain component under Jest
const React = require("react");
const { View } = require("react-native");

const SvgMock = (props) => React.createElement(View, { testID: "svg", ...props });

module.exports = SvgMock;
module.exports.default = SvgMock;
module.exports.ReactComponent = SvgMock;
