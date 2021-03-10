module.exports = {
	dev: {
		url: process.env.POSTGRES_URL,
		dialect: "postgres",
		define: {
			underscored: true,
			freezeTableName: true
		}
	}
};
