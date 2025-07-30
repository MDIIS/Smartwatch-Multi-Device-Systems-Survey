

(function(){
	// 数据变量
	var affiliationDim = ['name', 'Affiliation at the time of award']; // 映射展示名
	var dimensionsArray = ['Title','Publication Year','Publication Venue', 'System NO.', 'Configuration', 'Role', 'Interaction', 'Application Domain', 'Relationship', 'Proxemics', 'Dynamics']; // 要处理的维度
	var dimensions = {}; // 存储每个维度的值和过滤器
	var documents; // 原始数据列表
	const isTall = (name) => name === 'Title' || name === 'Application Domain';

	// d3 使用的变量
	var elasticList, xAxis, x, margin, cols, tooltip;
	var header_height = 25, dimensionHeaderHeight = 40;
	var trimmerAt = 35, heightEmpty = "4px", sortValues = false;


	// 初始化 tooltip
	tooltip = d3.select("#mytooltip")
        .style("visibility", "hidden")
        .style("background-color", "#333333");

	// 初始化维度对象结构
	dimensionsArray.forEach(function(dim) {
		dimensions[dim] = {
			allValues: new Set(), // ✅ 记录所有可能值
			values: {},
			filters: d3.set()
		};
	});


	// 加载数据并初始化维度数据
	var onDataLoaded = function(error, csv) {
		if (error) throw error;

		console.log(csv.length + " documents");
		console.log("CSV header fields:", Object.keys(csv[0]));
		documents = csv;

		if (Array.isArray(documents)) {
			documents.forEach(function(d) {
				d.__filtered__ = true; // 标记文档为默认通过筛选
				dimensionsArray.forEach(function(dim) {
					const field = d[dim];
					if (typeof field === 'string' && field.trim() !== "") {
						// 收集所有可能值
						field.split('&').forEach(function(value) {
						  value = value.trim();
						  if (value) {
							dimensions[dim].values[value] = (dimensions[dim].values[value] || 0) + 1;
							dimensions[dim].allValues.add(value); // ✅ 永久保存
						  }
						});
					} else {
						console.warn(`⚠️ Missing or invalid field "${dim}" in row:`, d);
					}
				});
			});
			draw(); // 初次渲染界面
		} else {
			console.error("Invalid data format. Expected an array.");
		}
	};


	// 更新过滤器逻辑
	var updateFilters = function(dim, item) {
		var items = item.split('&').map(value => value.trim());
		items.forEach(function(singleItem) {
			if (dimensions[dim].filters.has(singleItem)) {
				dimensions[dim].filters.remove(singleItem);
			} else {
				dimensions[dim].filters.add(singleItem);
			}
		});
		updateData();
	};


	// 更新文档过滤结果和维度计数
	var updateData = function() {
		dimensionsArray.forEach(dim => {
			dimensions[dim].values = {}; // 清空当前值计数
		});

		documents.forEach(function(d) {
			let match = true;

			for (let dim of dimensionsArray) {
				const field = d[dim];
				if (!field) continue;
				const values = field.split('&').map(s => s.trim());
				const filters = dimensions[dim].filters;

				if (!filters.empty()) {
					if (!values.some(v => filters.has(v))) {
						match = false;
						break;
					}
				}
			}

			d.__filtered__ = match;

			if (match) {
				dimensionsArray.forEach(function(dim) {
					const field = d[dim];
					if (!field) return;
					field.split('&').forEach(function(v) {
						const value = v.trim();
						if (!value) return;
						dimensions[dim].values[value] = (dimensions[dim].values[value] || 0) + 1;
					});
				});
			}
		});

		redraw();
	};


	// 绘制维度头、容器等结构
	var draw = function() {
		margin = {top: 20, right: 20, bottom: 20, left: 20},
		width = 2000 - margin.left - margin.right,
		height = 400 - margin.top - margin.bottom + dimensionHeaderHeight,
		value_cell_padding = 1,
		value_cell_height = 45;

		x = d3.scale.ordinal()
			.domain(dimensionsArray)
			.rangeRoundBands([0, width]);

		xAxis = d3.svg.axis()
			.scale(x)
			.orient("bottom");

		elasticList = d3.select("#elastic-list")
			.attr("class", "elastic-list")
			.style("width", width + "px")
			.style("height", height + "px");

		// 维度列标题
		elasticList.append("div")
			.attr("class", "elastic-list-dimension-headers")
			.selectAll(".elastic-list-dimension-header")
			.data(dimensionsArray)
			.enter()
			.append("div")
			.attr("class", "elastic-list-dimension-header")
			.style("width", x.rangeBand() + "px")
			.style("height", dimensionHeaderHeight + "px")
			.text(function(d) {
				return (d == affiliationDim[0]) ? affiliationDim[1].capitalize() : d.capitalize();
			});

		// 筛选信息展示栏
		d3.select("#filtering").append("div")
			.attr("class", "elastic-list-filters")
			.style("height", header_height)
			.append("p");

		// 结果展示区域
		d3.select("#results")
			.style("width", width + "px")
			.style("height", 300 + "px");

		redraw();
	};


	// ✅ 完整修复后的 redraw 函数：包含 exit 清理和正确的 enter 构建逻辑
	var redraw = function() {
		var transitionTime = 1000;

		var getMinValueDimension = function(dimension) {
			return d3.min(
				d3.values(dimension.value.values).filter(function(value) {
					return value > 0;
				})
			);
		};

		var getValuesDimension = function(dimension) {
			var entries = d3.entries(dimension.value.values);
			if (!sortValues) return entries;
			return entries
				.sort((a, b) => (a.value > b.value ? -1 : a.value < b.value ? 1 : 0))
				.filter(obj => obj.key !== "");
		};

		// 清除旧列和旧项
		elasticList.selectAll(".elastic-list-dimension").remove();

		// 为每个维度构建列
		d3.entries(dimensions).forEach(function(dimEntry) {
			var dimName = dimEntry.key;
			var values = getValuesDimension(dimEntry);
			var minValue = getMinValueDimension(dimEntry);

			var column = elasticList.append("div")
				.attr("class", "elastic-list-dimension")
				.attr("__minvalue__", minValue)
				.style("width", x.rangeBand() + "px")
				.style("height", (height - dimensionHeaderHeight) + "px");

			var items = column.selectAll(".elastic-list-dimension-item")
				.data(values)
				.enter()
				.append("div")
				.attr("class", "elastic-list-dimension-item")
				.style("width", x.rangeBand() + "px")
				.style("height", function(d) {
					return d.value === 0 ? heightEmpty : (isTall(dimName) ? 80 : 45) + "px";
				})
				.classed("filter", d => dimensions[dimName].filters.has(d.key))
				.on("mouseover", function(d) {
					if (d.value === 0 || d3.select(this).text().indexOf("...") > -1) {
						tooltip
							.html(d.key + ": " + (d.value === 0 ? "no matchings" : d.value))
							.style("visibility", "visible");
					}
					d3.select(this).classed("elastic-list-dimension-item-hover", true);
				})
				.on("mousemove", function() {
					tooltip.style("top", (d3.event.pageY - 20) + "px")
						.style("left", (d3.event.pageX + 5) + "px");
				})
				.on("mouseout", function() {
					tooltip.style("visibility", "hidden");
					d3.select(this).classed("elastic-list-dimension-item-hover", false);
				})
				.on("click", function(d) {
					tooltip.style("visibility", "hidden");
					updateFilters(dimName, d.key);
					d3.select(this).classed("elastic-list-dimension-item-hover", false);
					d3.select(this).classed("filter", dimensions[dimName].filters.has(d.key));
				});

			// 添加文字内容
			items.each(function(d) {
				d3.select(this).selectAll("p").remove();
				if (d.value > 0) {
					const maxLength = (dimName === 'Title' || dimName === 'Application Domain') ? 70 : trimmerAt;
					d3.select(this).append("p")
						.attr("class", "key")
						.html(d.key.length > maxLength ? d.key.substring(0, maxLength) + "..." : d.key)
						.style("opacity", 0)
						.transition().duration(transitionTime).delay(200).style("opacity", 1);
					d3.select(this).append("p")
						.attr("class", "value")
						.html("<b>" + d.value + "</b>")
						.style("opacity", 0)
						.transition().duration(transitionTime).delay(200).style("opacity", 1);
				}
			});
		});

		// 展示筛选结果
		var html = "";
		documents.forEach(function(d) {
			if (d.__filtered__)
				html += "<p style='margin-bottom: 5px;'>" + d.Title + "</p>";
		});
		d3.select("#results").html(html);
		d3.select("#results-count").html("Found " + d3.select("#results").selectAll("p").size());
	};

	String.prototype.capitalize = function()
	{
    	return this.charAt(0).toUpperCase() + this.slice(1);
	}

	d3.csv("tab.csv", onDataLoaded);
}());