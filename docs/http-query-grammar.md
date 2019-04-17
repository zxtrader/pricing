```ebnf
URL_QUERY       ::= QUERY (',' QUERY)+
QUERY           ::= DATE ':' MASTER_CURRENCY ':' PRICE_CURRENCY (':' ('TEST')?)?
MASTER_CURRENCY ::= CURRENCY
PRICE_CURRENCY  ::= CURRENCY
PRICE_MAKER     ::= CURRENCY
CURRENCY        ::= (CHAR | DIG)+
DATE            ::= DIG DIG DIG DIG DIG DIG DIG DIG DIG DIG DIG DIG DIG DIG
DIG             ::= [0-9]
CH              ::= [A-Z]
```


https://www.bottlecaps.de/rr/ui


[dddd](http-query-grammar.html)
