# 优化计划
+ 在使用mvt-add-context的时候，支持为core层添加context，这些context会被认为是shared level的context
+ 在使用mvt-add-context的时候，当添加一个context是skills级别的时候，应该增加一个选项与用户交互，让ai来分析该context应该属于哪个skill，并且与用户确认后，这样可以避免在skills过多的情况下，用户选择skills的时候过于麻烦
+ knowledge.core中的manifest应该进行重构
+ mvt-analyze-code的产物应该放在knowledge层 而不是workspace层
+ mvt-init之后应该显式的建议用户使用mvt-analyze-code或者mvt-add-context来添加context
+ 添加plan dev的功能？（不确定，目的是当一个开发任务比较大的时候，需要输出一个开发计划的yml文件，用来跟踪开发进度，便于ai可以在后续进行恢复进度，继续开发）
+ /mvt-check-context的优化。不需要检查skills等系统内置的文件，只需要检查knowledge层的数据，和registry需要加载的context数据
+ /mvt-resume新skill的功能，用于用户在新的对话开启后，继续之前的对话，继续之前的开发任务。
+ 在config.yaml中增加document_output_language的配置，用于指定生成文档的语言