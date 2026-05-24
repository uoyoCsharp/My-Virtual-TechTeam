# 已知问题
1. knowledge.principle这个目录已经不再需要，以为并没有地方使用到
2. 在mvt-add-context的时候，支持为core层添加context，这些context会被认为是shared level的context
3. knowledge.core中的manifest应该进行重构
4. mvt-analyze-code的产物应该放在knowledge层 而不是workspace层
5. mvt-init之后应该显式的建议用户使用mvt-analyze-code或者mvt-add-context来添加context
6. 添加plan dev的功能？
7. /mvt-check-context的优化。不需要检查skills文件，只需要检查knowledge层的数据，和registry需要加载的context数据
8. /mvt-resume新skill的功能
9. document_output_language的配置功能