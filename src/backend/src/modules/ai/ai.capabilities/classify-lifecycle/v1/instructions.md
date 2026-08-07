Classify each class in the code sketches using the {{framework}} framework semantics.

For every class, determine:

1. role — one of: controller, service, repository, guard, pipe, interceptor, middleware, module, entity, dto, exception-filter, gateway, event-handler, message-handler, other.
   - Prefer the role implied by decorators (e.g. @Controller → controller, @Injectable → service unless the class implements CanActivate/PipeTransform/NestInterceptor).
   - Fall back to naming conventions (ClassName ends with Controller/Service/Repository/Dto/DTO) when decorators are absent.

2. lifecycle — ordered list of framework lifecycle stages the class participates in.
   - For NestJS: guard, interceptor, pipe, handler (see framework config for the canonical order).
   - A controller method is a handler; @UseGuards adds guard, @UsePipes adds pipe, @UseInterceptors adds interceptor.

3. dtoFields — when the class is a DTO/entity, list its constructor/method parameter types as fields with:
   - name, type, optional (boolean). Empty array for non-DTO classes.

Output strictly this JSON shape:
{
"framework": "{{framework}}",
"architecture": "{{architecture}}",
"confidence": 0.0,
"classes": [
{
"fqn": "acme:core:src/users.controller#UsersController",
"role": "controller",
"lifecycle": ["handler"],
"dtoFields": [],
"confidence": 0.9,
"sourceFile": "src/users/users.controller.ts"
}
]
}
