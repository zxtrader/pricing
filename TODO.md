# TODO Checklist

* глядя на задеплоенные сервисы в ранчере, не понятно из какого тега devops был деплоймент. (можно узнать через `helm list` но это много доступов нужно иметь). Возможно ве6рсию чарта вдючить в метаданные?!

## Production

* PSS-Provider-WTF2 - доставляет колбеки на https://callback.prodcryptopay.kube/v2/callback/cryptoproviders/pss-provider-wtf2/ на котором Kubernetes Ingress Controller Fake Certificate. Игнорит SSL?
