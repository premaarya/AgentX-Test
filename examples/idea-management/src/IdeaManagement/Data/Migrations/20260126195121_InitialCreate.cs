using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace IdeaManagement.Data.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ideas",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    description = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    submitted_by = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    submitted_date = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    estimated_roi = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    estimated_effort_hours = table.Column<int>(type: "integer", nullable: true),
                    risk_level = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: true),
                    impact_metrics = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    last_modified_date = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    reviewer_notes = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ideas", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ideas_status",
                table: "ideas",
                column: "status");

            migrationBuilder.CreateIndex(
                name: "IX_ideas_submitted_by",
                table: "ideas",
                column: "submitted_by");

            migrationBuilder.CreateIndex(
                name: "IX_ideas_submitted_date",
                table: "ideas",
                column: "submitted_date");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ideas");
        }
    }
}
