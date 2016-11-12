# k8s-templates-compiler
A simple system to manage variations of k8s templates in a multi-tenant scenario

The principle here is that you can have multiple k8s `clusters` (`test` and `prod` in the example scenario) and multiple *tenants* (`namespaces`) in each cluster.

You can have environment variables both at cluster level and at namespace level an you can mix them up, knowing that each namespace will end up with a set of variables derived from the merge of the provided files (`env_files`).

To run just do `npm i -g gulp && npm i` and then `gulp`.
Edit templates in the `templates` folder and the config files (`config.yaml` and files in `configs` folder).

The config files are loaded from yaml to json, merged and then provided as context to the `swig` compiler. The output files will go in the `dist/<cluster>/<namespace>` folder.

Pay attention to the `namespace: {{_ns_}}` part in the templates, which is what the whole system is based on. The `_ns_` (alias for `_namespace_`) and the `_env_` variables get populated respectively with the namespace name and the env (cluster) name in each template's compilation context.
