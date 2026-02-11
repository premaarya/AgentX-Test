---
description: 'Java and Spring Boot specific coding instructions for backend development.'
applyTo: '**.java'
---

# Java / Spring Boot Instructions

## Code Style

- Follow Google Java Style Guide
- Use Java 17+ features (records, sealed classes, pattern matching)
- Maximum line length: 120 characters
- Use `spotless` or `google-java-format` for formatting

## Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Class | PascalCase | `UserService` |
| Interface | PascalCase | `UserRepository` |
| Method | camelCase | `getUserById` |
| Variable | camelCase | `userCount` |
| Constant | UPPER_SNAKE | `MAX_RETRY_COUNT` |
| Package | lowercase | `com.example.users` |
| Enum | PascalCase | `OrderStatus.PENDING` |

## Records (DTOs)

```java
// ✅ Use records for immutable data carriers
public record CreateUserRequest(
    @NotBlank String email,
    @NotBlank String name,
    @NotNull UserRole role
) {}

public record UserResponse(
    UUID id,
    String email,
    String name,
    Instant createdAt
) {}
```

## Dependency Injection

```java
// ✅ Constructor injection (prefer over field injection)
@Service
public class UserService {
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    // Spring auto-injects for single constructor
    public UserService(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }
}
```

## Error Handling

```java
// ✅ Custom exception hierarchy
public class AppException extends RuntimeException {
    private final HttpStatus status;
    private final String code;

    public AppException(String message, HttpStatus status, String code) {
        super(message);
        this.status = status;
        this.code = code;
    }
}

public class NotFoundException extends AppException {
    public NotFoundException(String resource, Object id) {
        super("%s with id %s not found".formatted(resource, id),
              HttpStatus.NOT_FOUND, "NOT_FOUND");
    }
}

// ✅ Global exception handler
@RestControllerAdvice
public class GlobalExceptionHandler {
    @ExceptionHandler(AppException.class)
    public ResponseEntity<ProblemDetail> handleAppException(AppException ex) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(ex.getStatus(), ex.getMessage());
        problem.setProperty("code", ex.getCode());
        return ResponseEntity.status(ex.getStatus()).body(problem);
    }
}
```

## REST Controllers

```java
@RestController
@RequestMapping("/api/users")
@Validated
public class UserController {
    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping("/{id}")
    public ResponseEntity<UserResponse> getUser(@PathVariable UUID id) {
        return ResponseEntity.ok(userService.getById(id));
    }

    @PostMapping
    public ResponseEntity<UserResponse> createUser(@Valid @RequestBody CreateUserRequest request) {
        UserResponse user = userService.create(request);
        URI location = URI.create("/api/users/" + user.id());
        return ResponseEntity.created(location).body(user);
    }
}
```

## Async / Virtual Threads

```java
// ✅ Use virtual threads (Java 21+)
@Bean
public TomcatProtocolHandlerCustomizer<?> virtualThreadExecutor() {
    return handler -> handler.setExecutor(Executors.newVirtualThreadPerTaskExecutor());
}

// ✅ CompletableFuture for async operations
public CompletableFuture<List<User>> fetchUsersAsync(List<UUID> ids) {
    return CompletableFuture.supplyAsync(() ->
        ids.stream()
           .map(userRepository::findById)
           .flatMap(Optional::stream)
           .toList()
    );
}
```

## Testing

- Use **JUnit 5** for unit and integration tests
- Use **Mockito** for mocking dependencies
- Use **AssertJ** for fluent assertions
- Use **@SpringBootTest** sparingly (prefer sliced tests)
- Name tests: `MethodName_Scenario_ExpectedResult`

```java
@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private UserService userService;

    @Test
    void getById_existingUser_returnsUser() {
        var user = new User(UUID.randomUUID(), "test@example.com", "Test");
        when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));

        var result = userService.getById(user.getId());

        assertThat(result.email()).isEqualTo("test@example.com");
        verify(userRepository).findById(user.getId());
    }

    @Test
    void getById_missingUser_throwsNotFound() {
        var id = UUID.randomUUID();
        when(userRepository.findById(id)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> userService.getById(id))
            .isInstanceOf(NotFoundException.class)
            .hasMessageContaining(id.toString());
    }
}
```

## Security

- Use Spring Security with `SecurityFilterChain` (not `WebSecurityConfigurerAdapter`)
- Validate all inputs with Bean Validation (`@Valid`, `@NotBlank`, `@Size`)
- Use `PreparedStatement` or JPA (never concatenate SQL)
- Store secrets in environment variables or Spring Cloud Config
- Enable CSRF protection for web apps (disable only for stateless APIs)
