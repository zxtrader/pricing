{{/* vim: set filetype=mustache: */}}
{{/*
Expand the name of the chart.
*/}}
{{- define "service.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "service.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" -}}
{{- end -}}


{{- define "prefix" -}}
{{- if eq .Release.Name "tag" -}}
{{- else -}}
{{- printf "%s-" .Release.Name | lower -}}
{{- end -}}
{{- end -}}

{{- define "suffix" -}}
{{- if eq .Release.Name "tag" -}}
{{- else -}}
{{- printf "-%s" .Release.Name | lower -}}
{{- end -}}
{{- end -}}