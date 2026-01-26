using Microsoft.EntityFrameworkCore;
using FluentValidation;
using Serilog;
using IdeaManagement.Data;
using IdeaManagement.Services;
using IdeaManagement.Validators;
using Idea = IdeaManagement.Models.Idea;

// Configure Serilog from appsettings.json
Log.Logger = new LoggerConfiguration()
    .ReadFrom.Configuration(new ConfigurationBuilder()
        .AddJsonFile("appsettings.json")
        .AddJsonFile($"appsettings.{Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Production"}.json", true)
        .Build())
    .CreateLogger();

try
{
    Log.Information("Starting Idea Management API");

    var builder = WebApplication.CreateBuilder(args);

    // Use Serilog for logging
    builder.Host.UseSerilog();

    // Add services to the container
    builder.Services.AddControllers();
    
    // Configure PostgreSQL database
    var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
        ?? throw new InvalidOperationException("Connection string 'DefaultConnection' not found");
    
    builder.Services.AddDbContext<IdeaDbContext>(options =>
        options.UseNpgsql(connectionString));
    
    // Register application services
    builder.Services.AddScoped<IIdeaService, IdeaService>();
    
    // Register validators
    builder.Services.AddScoped<IValidator<Idea>, CreateIdeaValidator>();
    builder.Services.AddScoped<IValidator<Idea>, UpdateIdeaValidator>();
    
    // Configure Swagger/OpenAPI
    builder.Services.AddEndpointsApiExplorer();
    builder.Services.AddSwaggerGen(options =>
    {
        options.SwaggerDoc("v1", new Microsoft.OpenApi.Models.OpenApiInfo
        { 
            Title = "Idea Management API", 
            Version = "v1",
            Description = "API for managing ideas through their lifecycle from submission to production"
        });
    });
    
    // Configure CORS
    builder.Services.AddCors(options =>
    {
        options.AddDefaultPolicy(policy =>
        {
            policy.AllowAnyOrigin()
                  .AllowAnyMethod()
                  .AllowAnyHeader();
        });
    });
    
    // Configure health checks
    builder.Services.AddHealthChecks()
        .AddNpgSql(connectionString, name: "database");

    var app = builder.Build();

    // Configure the HTTP request pipeline
    if (app.Environment.IsDevelopment())
    {
        app.UseSwagger();
        app.UseSwaggerUI(options =>
        {
            options.SwaggerEndpoint("/swagger/v1/swagger.json", "Idea Management API v1");
        });
    }

    app.UseHttpsRedirection();
    app.UseCors();
    app.UseSerilogRequestLogging();
    
    app.MapControllers();
    
    app.MapHealthChecks("/health/live", new() { Predicate = _ => false });
    app.MapHealthChecks("/health/ready");

    app.Run();
}
catch (Exception ex)
{
    Log.Fatal(ex, "Application terminated unexpectedly");
}
finally
{
    Log.CloseAndFlush();
}

// Make Program class accessible for integration tests
public partial class Program { }
