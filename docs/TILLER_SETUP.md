```yaml
apiVersion: apps/v1beta2
kind: Deployment
metadata:
  labels:
    app: helm
    name: tiller
  name: tiller-deploy
  namespace: cexiopay-preproduction
spec:
  progressDeadlineSeconds: 600
  replicas: 1
  revisionHistoryLimit: 10
  selector:
    matchLabels:
      app: helm
      name: tiller
  strategy:
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 1
    type: RollingUpdate
  template:
    metadata:
      creationTimestamp: null
      labels:
        app: helm
        name: tiller
    spec:
      automountServiceAccountToken: true
      containers:
      - env:
        - name: TILLER_HISTORY_MAX
          value: "5"
        - name: TILLER_NAMESPACE
          value: cexiopay-preproduction
        image: harbor.infra.kube/rancherdefaultimg/tiller:v2.14.2
        imagePullPolicy: IfNotPresent
        livenessProbe:
          failureThreshold: 3
          httpGet:
            path: /liveness
            port: 44135
            scheme: HTTP
          initialDelaySeconds: 1
          periodSeconds: 10
          successThreshold: 1
          timeoutSeconds: 1
        name: tiller
        ports:
        - containerPort: 44134
          name: tiller
          protocol: TCP
        - containerPort: 44135
          name: http
          protocol: TCP
        readinessProbe:
          failureThreshold: 3
          httpGet:
            path: /readiness
            port: 44135
            scheme: HTTP
          initialDelaySeconds: 1
          periodSeconds: 10
          successThreshold: 1
          timeoutSeconds: 1
        resources: {}
        securityContext:
          capabilities: {}
        terminationMessagePath: /dev/termination-log
        terminationMessagePolicy: File
      dnsPolicy: ClusterFirst
      restartPolicy: Always
      schedulerName: default-scheduler
      securityContext: {}
      serviceAccount: tiller
      serviceAccountName: tiller
      terminationGracePeriodSeconds: 30
```


```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: tiller-manager
  namespace: cexiopay-preproduction
rules:
  - apiGroups:
      - ""
      - batch
      - extensions
      - apps
      - rbac.authorization.k8s.io
      - certmanager.k8s.io
    resources:
      - "*"
    verbs:
      - "*"
```

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: tiller-binding
  namespace: cexiopay-preproduction
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: tiller-manager
subjects:
  - kind: ServiceAccount
    name: tiller
    namespace: cexiopay-preproduction
```
